/** Experimental, Windows-only offline OCR. Does not alter the live stroke pipeline. */
import {useEffect,useRef,type MutableRefObject} from 'react';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {getPaperGuideMetrics,nearestPaperGuide} from '@/features/canvas/engine/paperGuides';
import type {PageContent,StrokeElement,BeautifiedWord} from '@/features/canvas/types';

let preloadStarted=false;
function preloadOCR(){
  if(preloadStarted||!isTauri())return;
  preloadStarted=true;
  console.info('[Notex OCR] Model arka planda hazırlanıyor');
  void invoke('notex_ocr_preload').then(
    ()=>console.info('[Notex OCR] Model hazır'),
    error=>{preloadStarted=false;console.warn('[Notex OCR] Model ön yüklenemedi',error);}
  );
}
type OcrLine={text:string;score:number|null;box:number[]|null};
type OcrResult={ok:boolean;lines:OcrLine[];inferenceMs?:number;model?:string;fallbackReason?:string|null};

type Rasterized={pngBase64:string;left:number;top:number;scale:number;width:number;height:number};
function rasterize(strokes:StrokeElement[]):Rasterized|null {
  if(typeof document==='undefined'||!strokes.length)return null;
  const left=Math.min(...strokes.map(s=>s.bbox[0]))-18;
  const top=Math.min(...strokes.map(s=>s.bbox[1]))-18;
  const right=Math.max(...strokes.map(s=>s.bbox[2]))+18;
  const bottom=Math.max(...strokes.map(s=>s.bbox[3]))+18;
  const width=right-left,height=bottom-top;
  if(width<12||height<5||width>2400||height>1200)return null;
  // Preserve small dots and Turkish diacritics. Scale UP small handwriting,
  // but cap the raster to avoid large allocations on the CPU OCR worker.
  const scale=Math.min(2,1600/width,480/height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width*scale));
  canvas.height=Math.max(1,Math.ceil(height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.scale(scale,scale);ctx.translate(-left,-top);
  ctx.strokeStyle='#000000';ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of strokes){
    const p=stroke.points;
    if(p.length<3)continue;
    ctx.lineWidth=Math.max(1.8,Math.min(5,stroke.width));
    if(p.length===3){
      ctx.beginPath();
      ctx.arc(p[0],p[1],Math.max(1.2,ctx.lineWidth/2),0,Math.PI*2);
      ctx.fillStyle='#000000';
      ctx.fill();
      continue;
    }
    ctx.beginPath();ctx.moveTo(p[0],p[1]);
    for(let i=3;i+1<p.length;i+=3)ctx.lineTo(p[i],p[i+1]);
    ctx.stroke();
  }
  const pngBase64=canvas.toDataURL('image/png').split(',')[1];
  return pngBase64?{pngBase64,left,top,scale,width,height}:null;
}

/** Only strokes created after opening the page are eligible. Existing notes stay untouched. */
export function useAutoHandwritingOCR(
  pageId:string,
  content:PageContent,
  contentRef:MutableRefObject<PageContent>,
  apply:(next:PageContent)=>void,
  template:string,
){
  useEffect(()=>{preloadOCR()},[]);
  const known=useRef<Set<string>>(new Set(content.elements.map(e=>e.id)));
  const drawing=useRef(false);
  const failures=useRef<Map<string,number>>(new Map());
  const busy=useRef(false);
  const queued=useRef<StrokeElement[][]>([]);
  const reserved=useRef<Set<string>>(new Set());
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const alive=useRef(true);
  const applyRef=useRef(apply);applyRef.current=apply;
  const pageRef=useRef(pageId);
  pageRef.current=pageId;
  const startedAt=useRef(0);
  // React StrictMode and development remounts run effect cleanup and setup
  // without recreating refs. A cleanup-only effect left alive=false forever,
  // so OCR worked initially and then silently stopped scheduling new work.
  useEffect(()=>{
    alive.current=true;
    scheduleRef.current();
    return ()=>{
      alive.current=false;
      if(timer.current){clearTimeout(timer.current);timer.current=null;}
      queued.current=[];
      reserved.current.clear();
    };
  },[]);
  const processRef=useRef<()=>void>(()=>{});
  const scheduleRef=useRef<()=>void>(()=>{});
  processRef.current=()=>{
    if(busy.current||!alive.current)return;
    const strokes=queued.current.shift();
    if(!strokes)return;
    busy.current=true;
    void (async()=>{
      console.info('[Notex OCR] Tanıma başlıyor',{pageId,strokeCount:strokes.length});
      const ids=strokes.map(s=>s.id);
      const raster=rasterize(strokes);
      if(!raster){
        console.warn('[Notex OCR] Görsel oluşturulamadı');
        ids.forEach(id=>reserved.current.delete(id));
        busy.current=false;
        processRef.current();
        return;
      }
      startedAt.current=Date.now();
      let completed=false;
      try{
        const response=await invoke<OcrResult>('notex_recognize_handwriting',{pngBase64:raster.pngBase64,engine:'paddle'});
        if(process.env.EXPO_PUBLIC_NOTEX_OCR_DIAGNOSTICS==='true'){
          // Opt-in diagnostics: the exact image sent to the model, its raw
          // output and timings. Never persist handwriting or upload it.
          console.groupCollapsed('[Notex OCR diagnostic] paddle / '+ids.length+' strokes');
          console.info('Input PNG (open in browser):','data:image/png;base64,'+raster.pngBase64);
          console.info('Raster',{width:raster.width,height:raster.height,scale:raster.scale});
          console.info('Raw recognition',{model:response.model,lines:response.lines,inferenceMs:response.inferenceMs,fallbackReason:response.fallbackReason});
          console.groupEnd();
        }
        if(!alive.current||pageRef.current!==pageId)return;
        const current=contentRef.current;
        const existing=new Set(current.elements.map(e=>e.id));
        if(ids.some(id=>!existing.has(id)))return;
        // New strokes are independent work; they must not invalidate this completed word.
        if((current.beautifications??[]).some(b=>b.sourceIds.some(id=>ids.includes(id))))return;
        console.info('[Notex OCR] Tanıma sonucu',{elapsedMs:Date.now()-startedAt.current,inferenceMs:response.inferenceMs,model:response.model,fallbackReason:response.fallbackReason,lines:response.lines});
        if(!response.ok)throw new Error('OCR returned an unsuccessful response');
        // Do not silently discard a low-confidence word while hiding ALL
        // source strokes: that permanently loses visible text in the result.
        const recognized=response.lines.filter(line=>line.text.trim());
        if(!recognized.length||recognized.some(line=>line.score==null||line.score<0.72)){
          console.warn('[Notex OCR] Eksik veya düşük güvenli tanıma; orijinal el yazısı korunuyor',response.lines);
          completed=true;
          return;
        }
        const left=Math.min(...strokes.map(s=>s.bbox[0]));
        const top=Math.min(...strokes.map(s=>s.bbox[1]));
        const right=Math.max(...strokes.map(s=>s.bbox[2]));
        const bottom=Math.max(...strokes.map(s=>s.bbox[3]));
        // OCR boxes are measured in the cropped raster's pixels. Restore
        // their original canvas coordinates to preserve placement and gaps.
        // If the detector omits a box, retain the source-stroke bounds.
        const validBox=(box:number[]|null):box is number[]=>!!box&&box.length>=4&&box.slice(0,4).every(Number.isFinite)&&box[2]>box[0]&&box[3]>box[1];
        // Use one consistent text height per writing row. Handwriting
        // ascenders/capitals must not inflate the displayed font.
        const rowStep=getPaperGuideMetrics(1,1).stepPage;
        const targetHeight=Math.min(43,rowStep*0.56);
        const words:BeautifiedWord[]=recognized.map((line,index)=>{
          const box=validBox(line.box)?line.box:null;
          const source:[number,number,number,number]=box
            ? [raster.left+box[0]/raster.scale,raster.top+box[1]/raster.scale,
               raster.left+box[2]/raster.scale,raster.top+box[3]/raster.scale]
            : [left,top+index*(bottom-top)/recognized.length,right,top+(index+1)*(bottom-top)/recognized.length];
          source[0]=Math.max(left,source[0]);
          source[2]=Math.min(right,source[2]);
          if(source[2]<=source[0]){source[0]=left;source[2]=right;}
          // Determine the nearest lower guide from the actual handwriting
          // center. Use the next guide as the writing baseline, not the
          // previous line's guide when letters extend below it.
          const sourceCenter=(source[1]+source[3])/2;
          const guide=(template==='çizgili'||template==='kareli')
            ? nearestPaperGuide(sourceCenter+rowStep*0.35,getPaperGuideMetrics(1,1),rowStep*0.5)
            : null;
          const baseline=guide?.baseline??source[3];
          const height=guide?targetHeight:Math.min(targetHeight,Math.max(18,source[3]-source[1]));
          return {
            id:ids[0]+'-ocr-'+index,text:line.text.trim(),
            bbox:[source[0],baseline-height,source[2],baseline],
            baseline,fontSize:height*0.95,
            color:strokes[0].color,font:'Caveat'
          };
        });
        // Keep the original first-word position. OCR boxes may be much
        // wider than the rendered Caveat glyphs, leaving artificial gaps.
        // Reflow only words that belong to the same writing row and are
        // reasonably close in the user's original handwriting.
        const existingWords=(current.beautifications??[])
          .filter(item=>item.mode==='beautified')
          .flatMap(item=>item.words);
        const estimatedWidth=(word:BeautifiedWord)=>Math.max(
          word.fontSize*0.45,
          Array.from(word.text).reduce((sum,char)=>sum+(
            /[ilıIİ.,'!]/.test(char)?0.26:
            /[mwMW]/.test(char)?0.72:0.48
          )*word.fontSize,0)
        );
        const sourcePositions=new Map(words.map(word=>[word.id,{left:word.bbox[0],right:word.bbox[2]}]));
        const ordered=[...words].sort((a,b)=>a.bbox[0]-b.bbox[0]);
        const placed:BeautifiedWord[]=[...existingWords];
        for(const word of ordered){
          const source=sourcePositions.get(word.id)!;
          const rowTolerance=Math.max(18,word.fontSize*0.65);
          const preceding=placed
            .filter(other=>Math.abs(other.baseline-word.baseline)<=rowTolerance&&other.bbox[0]<source.left)
            .sort((a,b)=>b.bbox[0]-a.bbox[0])[0];
          const width=Math.min(Math.max(estimatedWidth(word)*1.12,word.fontSize),Math.max(1,source.right-source.left));
          let x=source.left;
          if(preceding){
            const previousSource=sourcePositions.get(preceding.id);
            const previousRight=previousSource?.right??preceding.bbox[2];
            const originalGap=source.left-previousRight;
            const actualRight=preceding.bbox[0]+estimatedWidth(preceding)*1.12;
            // Small gaps become a readable single-space separation.
            // Large deliberate gaps remain anchored to the pen position.
            if(originalGap>=-8&&originalGap<Math.max(100,word.fontSize*2.8)){
              x=Math.max(actualRight+word.fontSize*0.26,
                Math.min(source.left,actualRight+word.fontSize*0.48));
            }
          }
          word.bbox=[x,word.bbox[1],x+width,word.bbox[3]];
          placed.push(word);
        }
        console.info('[Notex OCR] Yazı fonta dönüştürülüyor',words.map(w=>w.text));
        applyRef.current({...current,beautifications:[...(current.beautifications??[]),{sourceIds:ids,words,mode:'beautified'}]});
        completed=true;
      }catch(error){
        console.warn('[Notex OCR] Tanıma başarısız, orijinal çizgiler korundu:',error);
      }finally{
        // Transient OCR failures must not permanently discard strokes.
        // Retry a batch twice, then leave its original ink intact.
        const batchKey=ids.join('|');
        const tries=(failures.current.get(batchKey)??0)+1;
        if(completed||tries>=3){
          if(!completed)console.warn('[Notex OCR] Grup üç denemede tanınamadı, sonraki gruba geçiliyor',{strokeCount:ids.length});
          ids.forEach(id=>known.current.add(id));
          failures.current.delete(batchKey);
        }else{
          failures.current.set(batchKey,tries);
        }
        ids.forEach(id=>reserved.current.delete(id));
        busy.current=false;
        if(alive.current){
          processRef.current();
          scheduleRef.current();
        }
      }
    })();
  };
  scheduleRef.current=()=>{
    if(timer.current)clearTimeout(timer.current);
    if(!isTauri()||drawing.current||!alive.current)return;
    const pending=contentRef.current.elements.filter(
      (e):e is StrokeElement=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)&&!reserved.current.has(e.id)
    );
    if(!pending.length)return;
    timer.current=setTimeout(()=>{
      timer.current=null;
      if(drawing.current||!alive.current)return;
      const latest=contentRef.current.elements.filter(
        (e):e is StrokeElement=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)&&!reserved.current.has(e.id)
      );
      if(!latest.length)return;
      // Keep a writing row together: fixed 48-stroke slices used to cut words
      // mid-letter, producing nonsense OCR output and stranded fragments.
      // Split by vertical overlap, then by wide horizontal gaps only when a
      // row exceeds the raster width limit. Never split by stroke count.
      const ordered=[...latest].sort((a,b)=>(a.bbox[1]+a.bbox[3])-(b.bbox[1]+b.bbox[3]));
      const rows:StrokeElement[][]=[];
      for(const stroke of ordered){
        const cy=(stroke.bbox[1]+stroke.bbox[3])/2;
        const row=rows.find(group=>{
          const ys=group.map(item=>(item.bbox[1]+item.bbox[3])/2);
          const center=ys.reduce((a,b)=>a+b,0)/ys.length;
          return Math.abs(center-cy)<42;
        });
        if(row)row.push(stroke);else rows.push([stroke]);
      }
      for(const row of rows){
        const sorted=[...row].sort((a,b)=>a.bbox[0]-b.bbox[0]);
        let batch:StrokeElement[]=[];
        let left=Infinity,right=-Infinity;
        for(const stroke of sorted){
          const nextLeft=Math.min(left,stroke.bbox[0]);
          const nextRight=Math.max(right,stroke.bbox[2]);
          if(batch.length&&nextRight-nextLeft>2200){
            batch.forEach(item=>reserved.current.add(item.id));
            queued.current.push(batch);
            batch=[];left=Infinity;right=-Infinity;
          }
          batch.push(stroke);
          left=Math.min(left,stroke.bbox[0]);
          right=Math.max(right,stroke.bbox[2]);
        }
        if(batch.length){
          batch.forEach(item=>reserved.current.add(item.id));
          queued.current.push(batch);
        }
      }
      processRef.current();
    },2400);
  };
  useEffect(()=>{scheduleRef.current()},[content.elements]);
  return (active:boolean)=>{
    drawing.current=active;
    if(active&&timer.current){clearTimeout(timer.current);timer.current=null;}
    if(!active)scheduleRef.current();
  };
}
