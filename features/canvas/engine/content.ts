import {emptyContent,type PageContent,type Element,type StrokeElement} from '@/features/canvas/types';
function isStrokeElement(value:unknown):value is StrokeElement{
 if(!value||typeof value!=='object')return false;
 const stroke=value as Record<string,unknown>;
 return stroke.type==='stroke'&&typeof stroke.id==='string'&&typeof stroke.z==='number'&&Number.isFinite(stroke.z)&&typeof stroke.createdAt==='string'&&(stroke.tool==='pen'||stroke.tool==='highlighter')&&typeof stroke.color==='string'&&typeof stroke.width==='number'&&Number.isFinite(stroke.width)&&stroke.width>0&&typeof stroke.opacity==='number'&&Number.isFinite(stroke.opacity)&&stroke.opacity>=0&&stroke.opacity<=1&&(stroke.renderMode===undefined||stroke.renderMode==='centerline'||stroke.renderMode==='raw'||stroke.renderMode==='outline')&&Array.isArray(stroke.points)&&stroke.points.length>=3&&stroke.points.length%3===0&&stroke.points.every(n=>typeof n==='number'&&Number.isFinite(n))&&Array.isArray(stroke.bbox)&&stroke.bbox.length===4&&stroke.bbox.every(n=>typeof n==='number'&&Number.isFinite(n));
}
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
  if(safe.recognitionSourceStrokes!==undefined&&(!Array.isArray(safe.recognitionSourceStrokes)||!safe.recognitionSourceStrokes.every(isStrokeElement)))delete safe.recognitionSourceStrokes;
  if(safe.recognitionManuallyEdited!==undefined&&typeof safe.recognitionManuallyEdited!=='boolean')delete safe.recognitionManuallyEdited;
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
 if(e.type==='text')return typeof e.text==='string'&&e.text.length<=100000&&typeof e.color==='string'&&typeof e.bold==='boolean'&&['left','center','right'].includes(String(e.align))&&(e.fontFamily===undefined||e.fontFamily==='Inter'||e.fontFamily==='SpaceGrotesk')&&(e.recognitionManuallyEdited===undefined||typeof e.recognitionManuallyEdited==='boolean')&&['x','y','w','fontSize'].every(k=>typeof e[k]==='number'&&Number.isFinite(e[k]))&&Number(e.w)>0&&Number(e.fontSize)>=16&&Number(e.fontSize)<=200&&Array.isArray(e.bbox)&&e.bbox.length===4&&e.bbox.every(n=>typeof n==='number'&&Number.isFinite(n))&&(e.recognitionSourceStrokes===undefined||Array.isArray(e.recognitionSourceStrokes)&&e.recognitionSourceStrokes.every(isStrokeElement));
 return false;
 });
 const h=typeof obj.h==='number'&&Number.isFinite(obj.h)&&obj.h>=1414?Math.min(obj.h,1000000):undefined;
 const images=Array.isArray(obj.images)?obj.images.filter((value):value is import('@/features/canvas/types').PageImage=>{if(!value||typeof value!=='object')return false;const i=value as Record<string,unknown>;return typeof i.id==='string'&&typeof i.uri==='string'&&i.uri.startsWith('data:image/')&&['x','y','width','height'].every(k=>typeof i[k]==='number'&&Number.isFinite(i[k]))&&Number(i.width)>0&&Number(i.height)>0}):[];
 const beautifications=Array.isArray(obj.beautifications)?obj.beautifications.filter((value):value is import('@/features/canvas/types').Beautification=>{
 if(!value||typeof value!=='object')return false;
 const b=value as Record<string,unknown>;
 return Array.isArray(b.sourceIds)&&b.sourceIds.every(id=>typeof id==='string')&&Array.isArray(b.words)&&b.words.every(word=>{if(!word||typeof word!=='object')return false;const w=word as Record<string,unknown>;return typeof w.id==='string'&&typeof w.text==='string'&&w.text.length<=10000&&Array.isArray(w.bbox)&&w.bbox.length===4&&w.bbox.every(n=>typeof n==='number'&&Number.isFinite(n))&&typeof w.baseline==='number'&&Number.isFinite(w.baseline)&&typeof w.fontSize==='number'&&w.fontSize>0&&w.fontSize<=200&&typeof w.color==='string'&&(['Inter','InterBold','Caveat','PatrickHand','DancingScript','Kalam'] as unknown[]).includes(w.font)})&&(b.mode==='original'||b.mode==='beautified');
 }):[];
 return {...(h===undefined?{v:2 as const,elements,images}:{v:2 as const,elements,images,h}),beautifications};
 }catch{return emptyContent()}
}
export function serializeContent(content:PageContent){return JSON.stringify(content)}
export const round=(v:number)=>Math.round(v*10)/10;
