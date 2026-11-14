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
type OcrLine={text:string;score:number|null;box:number[]|null;alternatives?:string[]};
type OcrResult={ok:boolean;lines:OcrLine[];inferenceMs?:number;model?:string;fallbackReason?:string|null;recognitionPass?:'original'|'enhanced'};

type Rasterized={pngBase64:string;left:number;top:number;scale:number;width:number;height:number};
function rasterize(strokes:StrokeElement[]):Rasterized|null {
  if(typeof document==='undefined'||!strokes.length)return null;
  // Use actual sampled points as well as cached bounds. Small detached marks
  // (i/İ dots, umlauts, cedillas) must not be cropped or dropped.
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  let widest=1;
  for(const stroke of strokes){
    const p=stroke.points;
    if(p.length<3)continue;
    widest=Math.max(widest,Number.isFinite(stroke.width)?stroke.width:1);
    for(let i=0;i+2<p.length;i+=3){
      const x=p[i],y=p[i+1];
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
  }
  if(!Number.isFinite(minX))return null;
  const padding=Math.max(18,Math.min(32,widest*2+12));
  const left=minX-padding,top=minY-padding;
  const width=maxX-minX+padding*2,height=maxY-minY+padding*2;
  if(width<12||height<5||width>2400||height>1200)return null;
  // Preserve fine details at a target scale while bounding CPU/memory use.
  // Scale may fall below 1 on long lines; all OCR boxes use this exact scale.
  const scale=Math.min(2.5,1600/width,480/height);
  if(!Number.isFinite(scale)||scale<=0)return null;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width*scale));
  canvas.height=Math.max(1,Math.ceil(height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.scale(scale,scale);ctx.translate(-left,-top);
  ctx.strokeStyle='#000000';ctx.fillStyle='#000000';
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of strokes){
    const p=stroke.points;
    if(p.length<3)continue;
    const lineWidth=Math.max(1.5,Math.min(5,Number.isFinite(stroke.width)?stroke.width:2));
    ctx.lineWidth=lineWidth;
    // A tap or detached diacritic can be a single sample.
    if(p.length===3){
      ctx.beginPath();ctx.arc(p[0],p[1],Math.max(0.9,lineWidth/2),0,Math.PI*2);ctx.fill();
      continue;
    }
    ctx.beginPath();ctx.moveTo(p[0],p[1]);
    let count=1;
    for(let i=3;i+2<p.length;i+=3){
      if(!Number.isFinite(p[i])||!Number.isFinite(p[i+1]))continue;
      ctx.lineTo(p[i],p[i+1]);count++;
    }
    if(count===1){
      ctx.beginPath();ctx.arc(p[0],p[1],Math.max(0.9,lineWidth/2),0,Math.PI*2);ctx.fill();
    }else ctx.stroke();
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
  const generation=useRef(0);
  // React StrictMode and development remounts run effect cleanup and setup
  // without recreating refs. A cleanup-only effect left alive=false forever,
  // so OCR worked initially and then silently stopped scheduling new work.
  useEffect(()=>{
    alive.current=true;
    generation.current++;
    scheduleRef.current();
    return ()=>{
      alive.current=false;
      generation.current++;
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
    const requestGeneration=generation.current;
    void (async()=>{
      console.info('[Notex OCR] Tanıma başlıyor',{pageId,strokeCount:strokes.length});
      const ids=strokes.map(s=>s.id);
      const raster=rasterize(strokes);
      if(!raster){
        console.warn('[Notex OCR] Görsel oluşturulamadı; orijinal çizgiler korunuyor');
        ids.forEach(id=>{reserved.current.delete(id);known.current.add(id);});
        busy.current=false;
        scheduleRef.current();
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
          console.info('Raw recognition',{model:response.model,lines:response.lines,inferenceMs:response.inferenceMs,fallbackReason:response.fallbackReason,recognitionPass:response.recognitionPass});
          console.groupEnd();
        }
        if(!alive.current||pageRef.current!==pageId||generation.current!==requestGeneration)return;
        const current=contentRef.current;
        const existing=new Set(current.elements.map(e=>e.id));
        if(ids.some(id=>!existing.has(id)))return;
        // New strokes are independent work; they must not invalidate this completed word.
        if((current.beautifications??[]).some(b=>b.sourceIds.some(id=>ids.includes(id))))return;
        console.info('[Notex OCR] Tanıma sonucu',{elapsedMs:Date.now()-startedAt.current,inferenceMs:response.inferenceMs,model:response.model,fallbackReason:response.fallbackReason,lines:response.lines});
        if(!response.ok)throw new Error('OCR returned an unsuccessful response');
        // Do not silently discard a low-confidence word while hiding ALL
        // source strokes: that permanently loses visible text in the result.
        // Suggestions are informational until the user explicitly confirms them.
        // Never silently alter OCR text or its coordinates.
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
        if(generation.current!==requestGeneration){
          busy.current=false;
          return;
        }
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
      // Phase 2: build complete writing rows, keeping detached diacritics
      // with their base letters. A small dot's Y center must not create
      // an independent OCR row.
      type Row={strokes:StrokeElement[];top:number;bottom:number;left:number;right:number};
      const bounds=(stroke:StrokeElement)=>stroke.bbox;
      const height=(stroke:StrokeElement)=>Math.max(0,bounds(stroke)[3]-bounds(stroke)[1]);
      const sorted=[...latest].sort((a,b)=>height(b)-height(a));
      const rows:Row[]=[];
      const add=(row:Row,stroke:StrokeElement)=>{
        row.strokes.push(stroke);
        row.top=Math.min(row.top,stroke.bbox[1]);row.bottom=Math.max(row.bottom,stroke.bbox[3]);
        row.left=Math.min(row.left,stroke.bbox[0]);row.right=Math.max(row.right,stroke.bbox[2]);
      };
      const typicalHeight=Math.max(12,Math.min(55,
        [...sorted].map(height).filter(h=>h>=8).sort((a,b)=>a-b)[Math.floor(sorted.filter(s=>height(s)>=8).length/2)]??25
      ));
      const marks:StrokeElement[]=[];
      for(const stroke of sorted){
        if(height(stroke)<Math.max(7,typicalHeight*0.24)){marks.push(stroke);continue;}
        const cy=(stroke.bbox[1]+stroke.bbox[3])/2;
        const match=rows.map(row=>{
          const rowCy=(row.top+row.bottom)/2;
          const overlap=Math.min(row.bottom,stroke.bbox[3])-Math.max(row.top,stroke.bbox[1]);
          const distance=Math.abs(cy-rowCy);
          return {row,distance,overlap};
        }).filter(item=>item.overlap>=-typicalHeight*0.2&&item.distance<typicalHeight*0.95)
          .sort((a,b)=>a.distance-b.distance)[0];
        if(match)add(match.row,stroke);
        else rows.push({strokes:[stroke],top:stroke.bbox[1],bottom:stroke.bbox[3],left:stroke.bbox[0],right:stroke.bbox[2]});
      }
      // Assign punctuation, umlaut dots and i/İ dots by horizontal
      // proximity to a row's body; their vertical position is secondary.
      for(const mark of marks){
        const mx=(mark.bbox[0]+mark.bbox[2])/2;
        const my=(mark.bbox[1]+mark.bbox[3])/2;
        const candidate=rows.map(row=>{
          const horizontal=Math.max(0,row.left-mx,mx-row.right);
          const vertical=Math.max(0,row.top-my,my-row.bottom);
          return {row,horizontal,vertical,score:horizontal*2+vertical};
        }).filter(item=>item.horizontal<typicalHeight*1.5&&item.vertical<typicalHeight*1.7)
          .sort((a,b)=>a.score-b.score)[0];
        if(candidate)add(candidate.row,mark);
        else rows.push({strokes:[mark],top:mark.bbox[1],bottom:mark.bbox[3],left:mark.bbox[0],right:mark.bbox[2]});
      }
      rows.sort((a,b)=>a.top-b.top);
      for(const row of rows){
        // The rasterizer supports up to 2400 page units. Only split a
        // genuinely oversized row at a wide, explicit space, never at
        // an arbitrary stroke count or through a character.
        const ordered=[...row.strokes].sort((a,b)=>a.bbox[0]-b.bbox[0]);
        const chunks:StrokeElement[][]=[];
        let chunk:StrokeElement[]=[];
        let chunkLeft=Infinity,chunkRight=-Infinity;
        for(let i=0;i<ordered.length;i++){
          const stroke=ordered[i];
          const nextRight=Math.max(chunkRight,stroke.bbox[2]);
          const gap=stroke.bbox[0]-chunkRight;
          if(chunk.length&&nextRight-chunkLeft>2100&&gap>Math.max(28,typicalHeight*0.75)){
            chunks.push(chunk);chunk=[];chunkLeft=Infinity;chunkRight=-Infinity;
          }
          chunk.push(stroke);
          chunkLeft=Math.min(chunkLeft,stroke.bbox[0]);
          chunkRight=Math.max(chunkRight,stroke.bbox[2]);
        }
        if(chunk.length)chunks.push(chunk);
        for(const group of chunks){
          // Skip malformed/oversized groups rather than retrying them forever.
          const xs=group.flatMap(item=>[item.bbox[0],item.bbox[2]]);
          const ys=group.flatMap(item=>[item.bbox[1],item.bbox[3]]);
          const spanX=Math.max(...xs)-Math.min(...xs);
          const spanY=Math.max(...ys)-Math.min(...ys);
          if(spanX>2300||spanY>1100){
            console.warn('[Notex OCR] Grup OCR sınırını aşıyor; orijinal çizgiler korunuyor',{spanX,spanY});
            group.forEach(item=>known.current.add(item.id));
            continue;
          }
          group.forEach(item=>reserved.current.add(item.id));
          queued.current.push(group);
        }
      }
      processRef.current();
    },3200);
  };
  useEffect(()=>{scheduleRef.current()},[content.elements]);
  return (active:boolean)=>{
    drawing.current=active;
    if(active&&timer.current){clearTimeout(timer.current);timer.current=null;}
    if(!active)scheduleRef.current();
  };
}
