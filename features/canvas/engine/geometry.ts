import {Skia,type SkPath} from '@shopify/react-native-skia';
import {getStroke} from 'perfect-freehand';
import type {StrokeElement} from '@/features/canvas/types';
import {centerlinePathString,legacyCenterlinePathString} from './centerlinePath';
type Sample=[number,number,number];
const distance=(a:Sample,b:Sample)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(p:Sample,a:Sample,b:Sample){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;if(!len)return distance(p,a);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
export function makeStroke(samples:Sample[],options:Pick<StrokeElement,'tool'|'color'|'width'|'opacity'>,id:string,z:number):StrokeElement{
 const points:number[]=[];let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const point of samples){points.push(point[0],point[1],point[2]);left=Math.min(left,point[0]);top=Math.min(top,point[1]);right=Math.max(right,point[0]);bottom=Math.max(bottom,point[1])}
 const pad=options.width/2;
 return {...options,id,type:'stroke',renderMode:'raw',z,createdAt:new Date().toISOString(),points,bbox:[left-pad,top-pad,right+pad,bottom+pad]};
}
export {centerlinePathString,appendPolylinePoint,legacyCenterlinePathString} from './centerlinePath';
export function strokePathString(stroke:StrokeElement):string{
 if(stroke.renderMode==='centerline'||stroke.renderMode==='raw'){
  const samples:Sample[]=[];for(let i=0;i<stroke.points.length;i+=3)samples.push([stroke.points[i],stroke.points[i+1],stroke.points[i+2]]);
  return stroke.renderMode==='raw'?centerlinePathString(samples):legacyCenterlinePathString(samples);
 }
 const points:Sample[]=[];for(let i=0;i<stroke.points.length;i+=3)points.push([stroke.points[i],stroke.points[i+1],stroke.points[i+2]]);
 const outline=getStroke(points,{size:stroke.width,thinning:stroke.tool==='pen'?0.55:0,smoothing:0,streamline:0,simulatePressure:points.every(p=>p[2]===0.5),start:{cap:true,taper:0},end:{cap:true,taper:0}});
 if(!outline.length)return '';
 const coordinates:[number,number][]=outline.map((point:readonly number[]):[number,number]=>[Number(point[0]),Number(point[1])]);
 return coordinates.map(([x,y]:[number,number],index:number)=>`${index===0?'M':'L'}${x} ${y}`).join(' ')+' Z';
}
const finalizedPathStrings=new WeakMap<StrokeElement,{svg:string}>();
export function cacheFinalizedStrokePath(stroke:StrokeElement,svg:string){finalizedPathStrings.set(stroke,{svg})}
export function strokePath(stroke:StrokeElement):SkPath{
 const finalized=finalizedPathStrings.get(stroke);
 const svg=finalized?.svg??strokePathString(stroke);
 if(finalized)finalizedPathStrings.delete(stroke);
 return Skia.Path.MakeFromSVGString(svg)??Skia.Path.Make();
}
export function strokeHit(stroke:StrokeElement,x:number,y:number,radius:number){const b=stroke.bbox;if(x<b[0]-radius||x>b[2]+radius||y<b[1]-radius||y>b[3]+radius)return false;const p:[number,number,number]=[x,y,0.5];for(let i=0;i<stroke.points.length;i+=3){const a:[number,number,number]=[stroke.points[i],stroke.points[i+1],0.5],j=Math.min(i+3,stroke.points.length-3),b:[number,number,number]=[stroke.points[j],stroke.points[j+1],0.5];if(segmentDistance(p,a,b)<radius+stroke.width/2)return true}return false}
