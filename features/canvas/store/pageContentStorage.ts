import {isTauriDesktop} from '@/utils/tauriFiles';
import {parseContent,serializeContent} from '@/features/canvas/engine/content';

type Draft={version:1;content:string;pending:boolean};
const prefix='notex:page-content:v1:';
const key=(id:string)=>prefix+id;
const storage=():Storage|null=>{
 if(!isTauriDesktop()||typeof window==='undefined')return null;
 try{return window.localStorage}catch{return null}
};
const valid=(content:string):boolean=>{
 try{
  const value=JSON.parse(content) as {v?:unknown;elements?:unknown};
  return value!==null&&value.v===2&&Array.isArray(value.elements)&&
   serializeContent(parseContent(content))===content;
 }catch{return false}
};
const read=(id:string):Draft|null=>{
 const s=storage();if(!s)return null;
 try{
  const raw=s.getItem(key(id));if(!raw)return null;
  const value=JSON.parse(raw) as Partial<Draft>;
  return value.version===1&&typeof value.content==='string'&&typeof value.pending==='boolean'&&valid(value.content)
   ?value as Draft:null;
 }catch{return null}
};
/** Synchronous write-ahead draft. Never erase SQLite data on quota/storage errors. */
export const stagePageContent=(id:string,content:string):void=>{
 const s=storage();if(!s)return;
 try{s.setItem(key(id),JSON.stringify({version:1,content,pending:true} satisfies Draft))}
 catch(error){console.warn('[Notex save] Local draft could not be stored',error)}
};
export const pendingPageContent=(id:string):string|null=>{
 const draft=read(id);return draft?.pending?draft.content:null;
};
/** Clear pending only when SQLite has saved this exact snapshot. */
export const confirmPageContent=(id:string,content:string):void=>{
 const s=storage();if(!s)return;
 const draft=read(id);
 if(!draft||draft.content!==content)return;
 try{s.setItem(key(id),JSON.stringify({...draft,pending:false}))}
 catch(error){console.warn('[Notex save] Local draft confirmation failed',error)}
};
export const discardPageContent=(id:string):void=>{
 try{storage()?.removeItem(key(id))}catch{}
};
