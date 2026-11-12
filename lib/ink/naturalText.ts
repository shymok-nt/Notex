import type {BeautifiedWord} from '@/features/canvas/types';
export const MAX_GLYPH_Y_OFFSET=1.5;
export const MAX_GLYPH_ANGLE_DEGREES=2;
export function wordSeed(text:string):number{
 let hash=2166136261;
 for(const char of text){hash^=char.codePointAt(0)??0;hash=Math.imul(hash,16777619)}
 return hash>>>0;
}
export function glyphOffsets(text:string):{char:string;dy:number;angle:number}[]{
 let state=wordSeed(text);
 const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 return Array.from(text,char=>({char,dy:(next()*2-1)*MAX_GLYPH_Y_OFFSET,angle:(next()*2-1)*MAX_GLYPH_ANGLE_DEGREES*Math.PI/180}));
}
export function fitWordFont(text:string,word:BeautifiedWord):number{
 const width=Math.max(1,word.bbox[2]-word.bbox[0]);
 const height=Math.max(1,word.bbox[3]-word.bbox[1]);
 return Math.max(1,Math.min(200,height*0.82,width/Math.max(1,Array.from(text).length*0.6)));
}
