import {emptyContent,type PageContent,type Element} from '@/features/canvas/types';
import {isStoredImagePath} from './storedImagePath';
export function parseContent(raw:string):PageContent{
 try{const data:unknown=JSON.parse(raw);if(!data||typeof data!=='object')return emptyContent();
 const obj=data as Record<string,unknown>;
 if(obj.v!==2||!Array.isArray(obj.elements))return emptyContent();
 const safeItems=obj.elements.map(item=>{
 if(!item||typeof item!=='object')return item;
 const e=item as Record<string,unknown>;
 if(e.type==='text'){
  const safe={...e};
  if(safe.fontFamily!==undefined&&safe.fontFamily!=='Inter'&&safe.fontFamily!=='SpaceGrotesk')delete safe.fontFamily;
  if(safe.minHeight!==undefined&&(typeof safe.minHeight!=='number'||!Number.isFinite(safe.minHeight)||safe.minHeight<0||safe.minHeight>1000000))delete safe.minHeight;
  return safe;
 }
 return item;
 });
 const elements=safeItems.filter((item):item is Element=>{
 if(!item||typeof item!=='object')return false;
 const e=item as Record<string,unknown>;
 if(typeof e.id!=='string'||!Array.isArray(e.bbox)||e.bbox.length!==4||!e.bbox.every(n=>typeof n==='number'&&Number.isFinite(n)))return false;
 if(e.type==='stroke')return Array.isArray(e.points)&&e.points.length%3===0&&e.points.every(n=>typeof n==='number'&&Number.isFinite(n));
 if(e.type==='shape'){const p=e.params as Record<string,unknown>|undefined;return ['line','arrow','rect','ellipse','triangle','polygon'].includes(String(e.kind))&&!!p&&['x','y','w','h','rotation'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))&&!!e.stroke}
 if(e.type==='text')return typeof e.text==='string'&&e.text.length<=100000&&typeof e.color==='string'&&typeof e.bold==='boolean'&&['left','center','right'].includes(String(e.align))&&(e.fontFamily===undefined||e.fontFamily==='Inter'||e.fontFamily==='SpaceGrotesk')&&(e.minHeight===undefined||typeof e.minHeight==='number'&&Number.isFinite(e.minHeight)&&e.minHeight>=0&&e.minHeight<=1000000)&&['x','y','w','fontSize'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k]))&&Number(e.w)>0&&Number(e.fontSize)>=16&&Number(e.fontSize)<=200&&Array.isArray(e.bbox)&&e.bbox.length===4&&e.bbox.every(n=>typeof n==='number'&&Number.isFinite(n));
 return false;
 });
 const h=typeof obj.h==='number'&&Number.isFinite(obj.h)&&obj.h>=1414?Math.min(obj.h,1000000):undefined;
 const images=Array.isArray(obj.images)?obj.images.filter((value):value is import('@/features/canvas/types').PageImage=>{if(!value||typeof value!=='object')return false;const i=value as Record<string,unknown>;return typeof i.id==='string'&&typeof i.uri==='string'&&(i.uri.startsWith('data:image/')||isStoredImagePath(i.uri))&&['x','y','width','height'].every(k=>typeof i[k]==='number'&&Number.isFinite(i[k]))&&Number(i.width)>0&&Number(i.height)>0}):[];
 const isPageImage=(value:unknown):value is import('@/features/canvas/types').PageImage=>{if(!value||typeof value!=='object')return false;const i=value as Record<string,unknown>;return typeof i.id==='string'&&typeof i.uri==='string'&&(i.uri.startsWith('data:image/')||isStoredImagePath(i.uri))&&['x','y','width','height'].every(k=>typeof i[k]==='number'&&Number.isFinite(i[k]))&&Number(i.width)>0&&Number(i.height)>0};
 const backgroundImage=isPageImage(obj.backgroundImage)?obj.backgroundImage:undefined;
 return {...(h===undefined?{v:2 as const,elements,images}:{v:2 as const,elements,images,h}),...(backgroundImage?{backgroundImage}:{})};
 }catch{return emptyContent()}
}
export function serializeContent(content:PageContent){return JSON.stringify(content)}
export const round=(v:number)=>Math.round(v*10)/10;
