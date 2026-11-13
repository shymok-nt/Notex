/** Experimental, Windows-only offline OCR. Does not alter the live stroke pipeline. */
import {useEffect,useRef,type MutableRefObject} from 'react';
import {isTauri,invoke} from '@tauri-apps/api/core';
import type {PageContent,StrokeElement,BeautifiedWord} from '@/features/canvas/types';

type OcrLine={text:string;score:number|null;box:number[]|null};
type OcrResult={ok:boolean;lines:OcrLine[]};

function rasterize(strokes:StrokeElement[]):string|null {
  if(typeof document==='undefined'||!strokes.length)return null;
  const left=Math.min(...strokes.map(s=>s.bbox[0]))-18;
  const top=Math.min(...strokes.map(s=>s.bbox[1]))-18;
  const right=Math.max(...strokes.map(s=>s.bbox[2]))+18;
  const bottom=Math.max(...strokes.map(s=>s.bbox[3]))+18;
  const width=right-left,height=bottom-top;
  if(width<30||height<8||width>2400||height>1200)return null;
  const scale=Math.min(2,1200/width,600/height);
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
  return canvas.toDataURL('image/png').split(',')[1]??null;
}

/** Only strokes created after opening the page are eligible. Existing notes stay untouched. */
export function useAutoHandwritingOCR(
  pageId:string,
  content:PageContent,
  contentRef:MutableRefObject<PageContent>,
  apply:(next:PageContent)=>void,
){
  const known=useRef<Set<string>>(new Set(content.elements.map(e=>e.id)));
  const drawing=useRef(false);
  const busy=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const alive=useRef(true);
  const applyRef=useRef(apply);applyRef.current=apply;
  const pageRef=useRef(pageId);
  useEffect(()=>()=>{alive.current=false;if(timer.current)clearTimeout(timer.current)},[]);
  const scheduleRef=useRef<()=>void>(()=>{});
  scheduleRef.current=()=>{
    if(timer.current)clearTimeout(timer.current);
    if(!isTauri()||drawing.current||busy.current)return;
    const pending=contentRef.current.elements.filter(
      (e):e is StrokeElement=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)
    );
    if(pending.length<2)return;
    timer.current=setTimeout(async()=>{
      if(drawing.current||busy.current||!alive.current)return;
      const strokes=contentRef.current.elements.filter(
        (e):e is StrokeElement=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)
      ).slice(-40);
      if(strokes.length<2)return;
      const pngBase64=rasterize(strokes);
      if(!pngBase64){strokes.forEach(s=>known.current.add(s.id));return;}
      busy.current=true;
      const ids=strokes.map(s=>s.id);
      try{
        const response=await invoke<OcrResult>('notex_recognize_handwriting',{pngBase64});
        if(!alive.current||pageRef.current!==pageId)return;
        const current=contentRef.current;
        const existing=new Set(current.elements.map(e=>e.id));
        if(ids.some(id=>!existing.has(id)))return;
        // Do not apply stale OCR when the user continued writing during inference.
        if(current.elements.some(e=>e.type==='stroke'&&e.tool==='pen'&&!known.current.has(e.id)&&!ids.includes(e.id)))return;
        const recognized=response.lines.filter(line=>line.text.trim()&&(line.score??0)>=0.55);
        if(!recognized.length)return;
        const left=Math.min(...strokes.map(s=>s.bbox[0]));
        const top=Math.min(...strokes.map(s=>s.bbox[1]));
        const right=Math.max(...strokes.map(s=>s.bbox[2]));
        const bottom=Math.max(...strokes.map(s=>s.bbox[3]));
        const fontSize=Math.max(18,Math.min(100,(bottom-top)/Math.max(1,recognized.length)*0.9));
        const words:BeautifiedWord[]=recognized.map((line,index)=>({
          id:ids[0]+'-ocr-'+index,text:line.text.trim(),
          bbox:[left,top+index*(bottom-top)/recognized.length,right,top+(index+1)*(bottom-top)/recognized.length],
          baseline:top+(index+1)*(bottom-top)/recognized.length,
          fontSize,color:strokes[0].color,font:'Caveat'
        }));
        applyRef.current({...current,beautifications:[...(current.beautifications??[]),{sourceIds:ids,words,mode:'beautified'}]});
      }catch(error){
        console.warn('[Notex OCR] Tanıma başarısız, orijinal çizgiler korundu:',error);
      }finally{
        ids.forEach(id=>known.current.add(id));
        busy.current=false;
        if(alive.current)scheduleRef.current();
      }
    },1100);
  };
  useEffect(()=>{scheduleRef.current()},[content.elements]);
  return (active:boolean)=>{drawing.current=active;if(active&&timer.current)clearTimeout(timer.current);else if(!active)scheduleRef.current()};
}
