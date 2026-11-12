import {Skia,type SkPath} from '@shopify/react-native-skia';
import type {Element,ShapeElement,ShapeKind,Bounds} from '@/features/canvas/types';
export function shapeBounds(p:ShapeElement['params']):Bounds{
 const {x,y,w,h,rotation}=p;
 const left=Math.min(x,x+w),right=Math.max(x,x+w),top=Math.min(y,y+h),bottom=Math.max(y,y+h);
 if(!rotation)return [left,top,right,bottom];
 const cx=(left+right)/2,cy=(top+bottom)/2;
 const cos=Math.cos(rotation),sin=Math.sin(rotation);
 const corners=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([px,py])=>[
  cx+(px-cx)*cos-(py-cy)*sin,
  cy+(px-cx)*sin+(py-cy)*cos
 ]);
 return [Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
}
export function shapePath(s:ShapeElement):SkPath{
 const {x,y,w,h,points}=s.params;
 const left=Math.min(x,x+w),top=Math.min(y,y+h),right=Math.max(x,x+w),bottom=Math.max(y,y+h);
 const num=(n:number)=>Number.isFinite(n)?String(n):'0';
 let svg='';
 if(s.kind==='line'||s.kind==='arrow'){
  svg=`M ${num(x)} ${num(y)} L ${num(x+w)} ${num(y+h)}`;
  if(s.kind==='arrow'){
   const a=Math.atan2(h,w),r=Math.max(14,s.stroke.width*4);
   svg+=` M ${num(x+w-r*Math.cos(a-0.5))} ${num(y+h-r*Math.sin(a-0.5))} L ${num(x+w)} ${num(y+h)} L ${num(x+w-r*Math.cos(a+0.5))} ${num(y+h-r*Math.sin(a+0.5))}`;
  }
 }else if(s.kind==='rect'){
  svg=`M ${num(left)} ${num(top)} L ${num(right)} ${num(top)} L ${num(right)} ${num(bottom)} L ${num(left)} ${num(bottom)} Z`;
 }else if(s.kind==='ellipse'){
  const rx=(right-left)/2,ry=(bottom-top)/2,cx=left+rx,cy=top+ry;
  if(rx>0&&ry>0)svg=`M ${num(cx+rx)} ${num(cy)} A ${num(rx)} ${num(ry)} 0 1 0 ${num(cx-rx)} ${num(cy)} A ${num(rx)} ${num(ry)} 0 1 0 ${num(cx+rx)} ${num(cy)} Z`;
 }else if(s.kind==='triangle'){
  svg=`M ${num(x+w/2)} ${num(y)} L ${num(x+w)} ${num(y+h)} L ${num(x)} ${num(y+h)} Z`;
 }else if(points&&points.length>=6){
  svg=points.map((v,i)=>i%2===0?`${i===0?'M':'L'} ${num(v)}`:` ${num(v)}`).join('')+' Z';
 }
 return (svg?Skia.Path.MakeFromSVGString(svg):null)??Skia.Path.Make();
}
export function makeShape(kind:ShapeKind,x:number,y:number,w:number,h:number,color:string,width:number,opacity:number,fill=false):ShapeElement{
 const params={x,y,w,h,rotation:0};return {id:'shape-'+Date.now()+'-'+Math.random().toString(36).slice(2),type:'shape',kind,params,stroke:{color,width,opacity},fill:fill?{color,opacity:0.2}:null,bbox:shapeBounds(params),z:0,createdAt:new Date().toISOString()};
}
export function moveElement(e:Element,dx:number,dy:number):Element{
 if(e.type==='text')return {...e,x:e.x+dx,y:e.y+dy,bbox:[e.bbox[0]+dx,e.bbox[1]+dy,e.bbox[2]+dx,e.bbox[3]+dy]};
 if(e.type==='stroke'){const points=e.points.map((v,i)=>i%3===0?v+dx:i%3===1?v+dy:v);const b=e.bbox;return {...e,points,bbox:[b[0]+dx,b[1]+dy,b[2]+dx,b[3]+dy]}}
 const params={...e.params,x:e.params.x+dx,y:e.params.y+dy,points:e.params.points?.map((v,i)=>v+(i%2===0?dx:dy))};return {...e,params,bbox:shapeBounds(params)};
}
export function scaleElement(e:Element,cx:number,cy:number,sx:number,sy:number):Element{
 if(e.type==='text'){
  const x=cx+(e.x-cx)*sx,y=cy+(e.y-cy)*sy,w=Math.max(20,e.w*Math.abs(sx)),fontSize=Math.max(16,Math.min(200,e.fontSize*Math.abs(sy)));
  const height=Math.max(fontSize*1.25,(e.bbox[3]-e.bbox[1])*Math.abs(sy));
  return {...e,x,y,w,fontSize,bbox:[x,y,x+w,y+height]};
 }
 if(e.type==='stroke'){const points=e.points.map((v,i)=>i%3===0?cx+(v-cx)*sx:i%3===1?cy+(v-cy)*sy:v);const b=e.bbox;return {...e,points,bbox:[Math.min(cx+(b[0]-cx)*sx,cx+(b[2]-cx)*sx),Math.min(cy+(b[1]-cy)*sy,cy+(b[3]-cy)*sy),Math.max(cx+(b[0]-cx)*sx,cx+(b[2]-cx)*sx),Math.max(cy+(b[1]-cy)*sy,cy+(b[3]-cy)*sy)]}}
 const p=e.params;const params={...p,x:cx+(p.x-cx)*sx,y:cy+(p.y-cy)*sy,w:p.w*sx,h:p.h*sy,points:p.points?.map((v,i)=>i%2===0?cx+(v-cx)*sx:cy+(v-cy)*sy)};return {...e,params,stroke:{...e.stroke,width:Math.max(0.1,e.stroke.width*Math.sqrt(Math.abs(sx*sy)))},bbox:shapeBounds(params)};
}
export function rotateElement(e:Element,cx:number,cy:number,angle:number):Element{
 const rotate=(x:number,y:number):[number,number]=>[cx+(x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle),cy+(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle)];
 if(e.type==='stroke'){const points=[...e.points];for(let i=0;i<points.length;i+=3)[points[i],points[i+1]]=rotate(points[i],points[i+1]);const xs=points.filter((_,i)=>i%3===0),ys=points.filter((_,i)=>i%3===1);return {...e,points,bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}}
 if(e.type==='text')return e; // Text rotation is intentionally unsupported.
 const p=e.params;const params={...p,rotation:p.rotation+angle};return {...e,params,bbox:shapeBounds(params)};
}
export function pointInside(poly:number[],x:number,y:number){let inside=false;for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){const xi=poly[i],yi=poly[i+1],xj=poly[j],yj=poly[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside}return inside}
export function lassoSelect(elements:Element[],poly:number[]):string[]{
 if(poly.length<6)return [];
 return elements.filter(e=>{const samples:number[][]=[];if(e.type==='stroke'){for(let i=0;i<e.points.length;i+=Math.max(3,Math.floor(e.points.length/120/3)*3))samples.push([e.points[i],e.points[i+1]])}
 else if(e.type==='text'){const b=e.bbox;samples.push([(b[0]+b[2])/2,(b[1]+b[3])/2])}
 else{const b=e.bbox;for(let i=0;i<=4;i++)for(let j=0;j<=4;j++)samples.push([b[0]+(b[2]-b[0])*i/4,b[1]+(b[3]-b[1])*j/4])}
 return samples.length>0&&samples.filter(p=>pointInside(poly,p[0],p[1])).length>=samples.length*0.5
 }).map(e=>e.id);
}
