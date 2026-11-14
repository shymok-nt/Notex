/** Notex Ink Engine / Phase 2.
 * Pure, offline preprocessing of existing pen strokes. No React, Skia,
 * database writes, OCR model, or mutation of original page content.
 * StrokeElement.points stores flat [x,y,pressure] triples; timestamps per
 * sample are NOT present in the existing format and must not be invented.
 */
import type {Bounds,StrokeElement} from '@/features/canvas/types';

export type InkPoint={x:number;y:number;pressure:number};
export type InkStroke={id:string;points:InkPoint[];bounds:Bounds;centerX:number;centerY:number;width:number;height:number;length:number;isMark:boolean};
export type InkWord={strokeIds:string[];bounds:Bounds;strokes:InkStroke[]};
export type InkLine={strokeIds:string[];bounds:Bounds;words:InkWord[];strokes:InkStroke[]};
export type InkDocument={lines:InkLine[];ignoredIds:string[];strokeCount:number};

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const union=(a:Bounds,b:Bounds):Bounds=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
const median=(values:number[],fallback:number)=>{if(!values.length)return fallback;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const gap=(a0:number,a1:number,b0:number,b1:number)=>Math.max(0,a0-b1,b0-a1);
const boundsOf=(points:InkPoint[]):Bounds=>{
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 return [left,top,right,bottom];
};

/** Filter nonfinite samples, collapse exact duplicate positions and translate
 * each stroke into its own local coordinate system only for model input.
 * Original page coordinates and sample order remain in InkStroke.points. */
export function normalizeInkStroke(stroke:StrokeElement):InkStroke|null{
 if(stroke.type!=='stroke'||stroke.tool!=='pen'||!Array.isArray(stroke.points))return null;
 const points:InkPoint[]=[];
 for(let i=0;i+2<stroke.points.length;i+=3){
  const x=stroke.points[i],y=stroke.points[i+1],pressure=stroke.points[i+2];
  if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  const previous=points[points.length-1];
  if(previous&&previous.x===x&&previous.y===y)continue;
  points.push({x,y,pressure:Number.isFinite(pressure)?clamp(pressure,0,1):0.5});
 }
 if(!points.length)return null;
 const bounds=boundsOf(points);
 let length=0;
 for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 const width=bounds[2]-bounds[0],height=bounds[3]-bounds[1];
 return {id:stroke.id,points,bounds,centerX:(bounds[0]+bounds[2])/2,centerY:(bounds[1]+bounds[3])/2,width,height,length,isMark:false};
}

export function toModelCoordinates(strokes:InkStroke[],targetSize=128):{id:string;points:InkPoint[]}[]{
 if(!strokes.length)return [];
 const bounds=strokes.map(s=>s.bounds).reduce(union);
 const size=clamp(targetSize,16,1024);
 const scale=(size-2)/Math.max(1,bounds[2]-bounds[0],bounds[3]-bounds[1]);
 return strokes.map(stroke=>({id:stroke.id,points:stroke.points.map(p=>({
  x:(p.x-bounds[0])*scale+1,y:(p.y-bounds[1])*scale+1,pressure:p.pressure
 }))}));
}

/** Group existing pen strokes into rows and words while retaining detached
 * i/İ and ö/ü dots, cedillas and short crossbars as independent samples.
 * Heuristics intentionally never assign a character identity. */
export function preprocessInk(strokes:readonly StrokeElement[]):InkDocument{
 const ignoredIds:string[]=[];
 const valid:InkStroke[]=[];
 for(const source of strokes){
  const normalized=normalizeInkStroke(source);
  if(normalized)valid.push(normalized);else ignoredIds.push(source.id);
 }
 if(!valid.length)return {lines:[],ignoredIds,strokeCount:0};
 const bodyHeights=valid.map(s=>s.height).filter(h=>h>=6);
 const typical=clamp(median(bodyHeights,24),10,70);
 const markLimit=Math.max(5,typical*0.25);
 for(const s of valid)s.isMark=s.height<markLimit&&s.width<typical*0.65;
 type Row={strokes:InkStroke[];bounds:Bounds};
 const rows:Row[]=[];
 const add=(row:Row,s:InkStroke)=>{row.strokes.push(s);row.bounds=union(row.bounds,s.bounds);};
 // Start with tall strokes to prevent diacritic dots becoming their own rows.
 for(const s of [...valid].filter(s=>!s.isMark).sort((a,b)=>b.height-a.height)){
  const candidates=rows.map(row=>{
   const b=row.bounds;
   const vertical=gap(s.bounds[1],s.bounds[3],b[1],b[3]);
   const distance=Math.abs(s.centerY-(b[1]+b[3])/2);
   const horizontal=gap(s.bounds[0],s.bounds[2],b[0],b[2]);
   return {row,vertical,distance,horizontal};
  }).filter(c=>c.vertical<=typical*0.22&&c.distance<=typical*1.1)
    .sort((a,b)=>(a.distance+a.horizontal*0.03)-(b.distance+b.horizontal*0.03));
  if(candidates.length)add(candidates[0].row,s);
  else rows.push({strokes:[s],bounds:[...s.bounds]});
 }
 // Attach detached marks using both proximity to the body and row spacing.
 for(const s of valid.filter(s=>s.isMark)){
  const matches=rows.map(row=>{
   const b=row.bounds;
   const horizontal=gap(s.bounds[0],s.bounds[2],b[0],b[2]);
   const vertical=gap(s.bounds[1],s.bounds[3],b[1],b[3]);
   return {row,horizontal,vertical,score:vertical+horizontal*0.7};
  }).filter(c=>c.horizontal<typical*1.3&&c.vertical<typical*1.6)
    .sort((a,b)=>a.score-b.score);
  if(matches.length)add(matches[0].row,s);
  else rows.push({strokes:[s],bounds:[...s.bounds]});
 }
 rows.sort((a,b)=>a.bounds[1]-b.bounds[1]||a.bounds[0]-b.bounds[0]);
 const lines=rows.map(row=>{
  const sorted=[...row.strokes].sort((a,b)=>a.bounds[0]-b.bounds[0]||a.centerY-b.centerY);
  // Estimate spacing from positive inter-stroke gaps; do not split at tiny
  // marks or overlapping letters. This is only a provisional word grouping.
  const gaps:number[]=[];
  for(let i=1;i<sorted.length;i++){
   const previous=sorted[i-1],current=sorted[i];
   if(previous.isMark||current.isMark)continue;
   const distance=current.bounds[0]-previous.bounds[2];
   if(distance>0)gaps.push(distance);
  }
  const typicalGap=median(gaps.filter(g=>g<typical*1.5),typical*0.18);
  const splitAt=Math.max(typical*0.72,typicalGap*2.8);
  const groups:InkStroke[][]=[];
  let current:InkStroke[]=[];
  let right=-Infinity;
  for(const s of sorted){
   const distance=s.bounds[0]-right;
   if(current.length&&!s.isMark&&distance>splitAt){groups.push(current);current=[];right=-Infinity;}
   current.push(s);right=Math.max(right,s.bounds[2]);
  }
  if(current.length)groups.push(current);
  const words=groups.map(group=>({
   strokeIds:group.map(s=>s.id),strokes:group,bounds:group.map(s=>s.bounds).reduce(union)
  }));
  return {strokeIds:row.strokes.map(s=>s.id),bounds:row.bounds,strokes:row.strokes,words};
 });
 return {lines,ignoredIds,strokeCount:valid.length};
}
