import type {Element,StrokeElement,Point,Bounds} from '@/features/canvas/types';
import {round} from './content';

type P=Point;
const distanceToSegment=(p:P,a:P,b:P)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
};
const near=(p:P,path:P[],radius:number)=>{
 if(path.length===1)return Math.hypot(p[0]-path[0][0],p[1]-path[0][1])-radius;
 let d=Infinity;for(let i=1;i<path.length;i++)d=Math.min(d,distanceToSegment(p,path[i-1],path[i]));return d-radius;
};
const lerp=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const bbox=(points:P[],pad:number):Bounds=>{
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return [Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad];
};
const overlaps=(a:Bounds,b:Bounds)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const pathLength=(points:P[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
// Convert an unfilled vector outline to centerline segments so the pixel eraser
// can split only the touched portion instead of deleting the entire shape.
const shapeOutline=(e:Extract<Element,{type:'shape'}>):P[]|null=>{
 const {x,y,w,h,points}=e.params;
 const left=Math.min(x,x+w),right=Math.max(x,x+w);
 const top=Math.min(y,y+h),bottom=Math.max(y,y+h);
 const pt=(a:number,b:number):P=>[a,b,0.5];
 if(e.kind==='line')return [pt(x,y),pt(x+w,y+h)];
 // Preserve arrowheads until multi-subpath clipping is supported.
 if(e.kind==='arrow')return null;
 if(e.kind==='rect')return [pt(left,top),pt(right,top),pt(right,bottom),pt(left,bottom),pt(left,top)];
 if(e.kind==='triangle')return [pt(x+w/2,y),pt(x+w,y+h),pt(x,y+h),pt(x+w/2,y)];
 if(e.kind==='polygon'&&points&&points.length>=6){
  const poly:P[]=[];
  for(let i=0;i<points.length;i+=2)poly.push(pt(points[i],points[i+1]));
  return [...poly,poly[0]];
 }
 if(e.kind==='ellipse'){
  const cx=(left+right)/2,cy=(top+bottom)/2,rx=(right-left)/2,ry=(bottom-top)/2;
  const count=Math.max(48,Math.ceil(2*Math.PI*Math.max(rx,ry)/2));
  return Array.from({length:count+1},(_,i)=>pt(cx+rx*Math.cos(2*Math.PI*i/count),cy+ry*Math.sin(2*Math.PI*i/count)));
 }
 return null;
};
export function pixelErase(elements:Element[],path:P[],radius:number,wholeStroke=false):Element[]{
 if(!path.length)return elements;
 const eraserBox=bbox(path,radius+80);
 let changed=false;
 const result:Element[]=[];
 for(const e of elements){
  if(!overlaps(e.bbox,eraserBox)){result.push(e);continue}
  if(e.type==='text'){
   const [left,top,right,bottom]=e.bbox;
   const touches=(p:P)=>p[0]>=left-radius&&p[0]<=right+radius&&p[1]>=top-radius&&p[1]<=bottom+radius;
   let hit=path.some(touches);
   for(let i=1;!hit&&i<path.length;i++){
    const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(1,radius)));
    for(let j=1;j<=steps;j++)if(touches(lerp(a,b,j/steps))){hit=true;break}
   }
   if(!hit){result.push(e);continue}
   changed=true;
   if(wholeStroke)continue;
   result.push({...e,erasures:[...(e.erasures??[]),{points:path.flatMap(p=>[p[0],p[1]]),radius}]});
   continue;
  }
  let source:StrokeElement;
  if(e.type==='shape'){
   if(e.fill||wholeStroke){
    // Filled shapes cannot be safely cut by centerline splitting.
    // Never remove a whole filled shape in pixel mode.
    result.push(e);continue;
   }
   const outline=shapeOutline(e);
   if(!outline){result.push(e);continue}
   source={id:e.id,type:'stroke',renderMode:'centerline',z:e.z,createdAt:e.createdAt,tool:'pen',color:e.stroke.color,width:e.stroke.width,opacity:e.stroke.opacity,points:outline.flatMap(p=>p),bbox:e.bbox};
  }else source=e;
  const original:P[]=[];
  for(let i=0;i<source.points.length;i+=3)original.push([source.points[i],source.points[i+1],source.points[i+2]]);
  if(!original.length){result.push(e);continue}
  const r=radius; // Match the displayed eraser radius; do not expand by pen width.
  // Resample long segments to prevent fast eraser movements from leaving gaps.
  const dense:P[]=[original[0]];
  for(let i=1;i<original.length;i++){
   const a=original[i-1],b=original[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const count=Math.max(1,Math.ceil(length/1));
   for(let j=1;j<=count;j++)dense.push(lerp(a,b,j/count));
  }
  const flags=dense.map(p=>near(p,path,r)<=0);
  if(!flags.some(Boolean)){result.push(e);continue}
  changed=true;
  if(wholeStroke)continue;
  const chunks:P[][]=[];let current:P[]=[];
  for(let i=0;i<dense.length;i++){
   const point=dense[i],inside=flags[i];
   if(i>0&&inside!==flags[i-1]){
    const a=dense[i-1],b=point;
    let lo=0,hi=1;
    for(let k=0;k<12;k++){
     const mid=(lo+hi)/2;
     if((near(lerp(a,b,mid),path,r)<=0)===flags[i-1])lo=mid;else hi=mid;
    }
    const boundary=lerp(a,b,(lo+hi)/2);
    if(inside){current.push(boundary);if(current.length>1)chunks.push(current);current=[]}
    else current=[boundary];
   }
   if(!inside)current.push(point);
  }
  if(current.length>1)chunks.push(current);
  for(let i=0;i<chunks.length;i++){
   const pts=chunks[i];if(pathLength(pts)<source.width*0.25)continue;
   const newStroke:StrokeElement={...source,id:source.id+'-cut-'+i+'-'+Date.now(),points:pts.flatMap(p=>p.map(round)),bbox:bbox(pts,source.width/2)};
   result.push(newStroke);
  }
 }
 return changed?result:elements;
}
