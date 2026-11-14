import {isTauriDesktop} from '@/utils/tauriFiles';

type Draft={version:1;content:string;base:string;pending:boolean};
const prefix='notex:page-content:v1:';
const key=(id:string)=>prefix+id;
const storage=():Storage|null=>{
 if(!isTauriDesktop()||typeof window==='undefined')return null;
 try{return window.localStorage}catch{return null}
};
const valid=(content:string):boolean=>{
 // SQLite may contain an empty string for a pristine/cleared page.
 if(content==='')return true;
 try{
  const value:unknown=JSON.parse(content);
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const data=value as {v?:unknown;elements?:unknown};
  // Do not compare to reserialized parseContent: parsing normalizes optional
  // fields (e.g. images: []) and otherwise rejects valid empty-page drafts.
  return data.v===2&&Array.isArray(data.elements);
 }catch{return false}
};
const read=(id:string):Draft|null=>{
 const s=storage();if(!s)return null;
 try{
  const raw=s.getItem(key(id));if(raw===null)return null;
  const value=JSON.parse(raw) as Partial<Draft>;
  return value.version===1&&typeof value.content==='string'&&typeof value.base==='string'&&typeof value.pending==='boolean'&&valid(value.content)&&valid(value.base)
   ?value as Draft:null;
 }catch{return null}
};
/** Synchronous write-ahead draft. Never erase SQLite data on quota/storage errors. */
export const stagePageContent=(id:string,content:string,base:string):boolean=>{
 const s=storage();if(!s)return !isTauriDesktop();
 try{
  const previous=read(id);
  s.setItem(key(id),JSON.stringify({version:1,content,base:previous?.pending?previous.base:base,pending:true} satisfies Draft));
  return true;
 }
 catch(error){console.error('[Notex save] Local draft could not be stored',error);return false}
};
export const pendingPageContent=(id:string,sqliteContent?:string):string|null=>{
 const draft=read(id);
 if(!draft?.pending)return null;
 // Never replace a SQLite value changed after this draft's base snapshot.
 if(sqliteContent!==undefined&&sqliteContent!==draft.base&&sqliteContent!==draft.content)return null;
 return draft.content;
};
/** Clear pending only when SQLite has saved this exact snapshot. */
export const confirmPageContent=(id:string,content:string):void=>{
 const s=storage();if(!s)return;
 const draft=read(id);
 if(!draft||!draft.pending)return;
 // An older autosave may finish after a newer edit was staged. Advance the
 // recovery base to the snapshot actually verified in SQLite, keeping the
 // newer local draft pending so it can still be recovered after a crash.
 const next=draft.content===content?{...draft,base:content,pending:false}:{...draft,base:content};
 try{s.setItem(key(id),JSON.stringify(next))}
 catch(error){console.warn('[Notex save] Local draft confirmation failed',error)}
};
export const discardPageContent=(id:string):void=>{
 try{storage()?.removeItem(key(id))}catch{}
};
