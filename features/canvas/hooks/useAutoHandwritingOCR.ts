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
  // OCR detector runs on CPU: avoid enlarging already legible handwriting.
  const scale=Math.min(1.25,960/width,320/height);
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
    ctx.lineWidth=Math.max(2,stroke.width);
    ctx.beginPath();ctx.moveTo(p[0],p[1]);
    for(let i=3;i+1<p.length;i+=3)ctx.lineTo(p[i],p[i+1]);
    if(p.length===3)ctx.lineTo(p[0]+0.1,p[1]+0.1);
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
  const startedAt=useRef(0);
  useEffect(()=>()=>{alive.current=false;if(timer.current)clearTimeout(timer.current)},[]);
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
        ids.forEach(id=>{reserved.current.delete(id);known.current.add(id)});
        busy.current=false;
        processRef.current();
        return;
      }
      startedAt.current=Date.now();
      let completed=false;
      try{
        const response=await invoke<OcrResult>('notex_recognize_handwriting',{pngBase64:raster.pngBase64});
        if(!alive.current||pageRef.current!==pageId)return;
        const current=contentRef.current;
        const existing=new Set(current.elements.map(e=>e.id));
        if(ids.some(id=>!existing.has(id)))return;
        // New strokes are independent work; they must not invalidate this completed word.
        if((current.beautifications??[]).some(b=>b.sourceIds.some(id=>ids.includes(id))))return;
        console.info('[Notex OCR] Tanıma sonucu',{elapsedMs:Date.now()-startedAt.current,inferenceMs:response.inferenceMs,model:response.model,fallbackReason:response.fallbackReason,lines:response.lines});
        if(!response.ok)throw new Error('OCR returned an unsuccessful response');
        const recognized=response.lines.filter(line=>line.text.trim()&&(line.score??0)>=0.45);
        if(!recognized.length){console.warn('[Notex OCR] Güvenilir metin bulunamadı');return;}
        const left=Math.min(...strokes.map(s=>s.bbox[0]));
        const top=Math.min(...strokes.map(s=>s.bbox[1]));
        const right=Math.max(...strokes.map(s=>s.bbox[2]));
        const bottom=Math.max(...strokes.map(s=>s.bbox[3]));
        // OCR boxes are measured in the cropped raster's pixels. Restore
        // their original canvas coordinates to preserve placement and gaps.
        // If the detector omits a box, retain the source-stroke bounds.
        const validBox=(box:number[]|null):box is number[]=>!!box&&box.length>=4&&box.slice(0,4).every(Number.isFinite)&&box[2]>box[0]&&box[3]>box[1];
        const words:BeautifiedWord[]=recognized.map((line,index)=>{
          const box=validBox(line.box)?line.box:null;
          const bounds:[number,number,number,number]=box
            ? [raster.left+box[0]/raster.scale,raster.top+box[1]/raster.scale,
               raster.left+box[2]/raster.scale,raster.top+box[3]/raster.scale]
            : [left,top+index*(bottom-top)/recognized.length,right,top+(index+1)*(bottom-top)/recognized.length];
          // Do not let the OCR detector's padding enlarge the writing region.
          bounds[0]=Math.max(left,bounds[0]);bounds[1]=Math.max(top,bounds[1]);
          bounds[2]=Math.min(right,bounds[2]);bounds[3]=Math.min(bottom,bounds[3]);
          if(bounds[2]<=bounds[0]||bounds[3]<=bounds[1]){
            bounds[0]=left;bounds[1]=top;bounds[2]=right;bounds[3]=bottom;
          }
          const height=bounds[3]-bounds[1];
          // Align to the nearest visible ruled/grid guide, never move text
          // to a different row when the handwriting is far from a guide.
          const guide=(template==='çizgili'||template==='kareli')
            ? nearestPaperGuide(bounds[3],getPaperGuideMetrics(1,1),36)
            : null;
          const baseline=guide?.baseline??bounds[3];
          if(guide){bounds[1]+=baseline-bounds[3];bounds[3]=baseline;}
          return {
            id:ids[0]+'-ocr-'+index,text:line.text.trim(),
            bbox:bounds,baseline,
            fontSize:Math.max(12,Math.min(100,height*0.9)),
            color:strokes[0].color,font:'Caveat'
          };
        });
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
      if(drawing.current||!alive.current)return;
      const latest=contentRef.current.elements.filter(
        (e):e is StrokeElement=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)&&!reserved.current.has(e.id)
      );
      if(!latest.length)return;
      // Freeze the writing session before invoking OCR. New strokes belong
      // to the next session and never modify an in-flight batch.
      for(let i=0;i<latest.length;i+=48){
        const batch=latest.slice(i,i+48);
        batch.forEach(stroke=>reserved.current.add(stroke.id));
        queued.current.push(batch);
      }
      processRef.current();
    },1000);
  };
  useEffect(()=>{scheduleRef.current()},[content.elements]);
  return (active:boolean)=>{
    drawing.current=active;
    if(active&&timer.current)clearTimeout(timer.current);
    if(!active)scheduleRef.current();
  };
}
