import { create } from 'zustand';
import { Alert } from 'react-native';
import { pageRepository } from '@/db/repositories/pageRepository';
import { useNotebookStore } from '@/store/notebookStore';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import {perfNow} from '@/features/canvas/engine/performance';
import {enqueuePageSave,flushPageSave,finishPageSave,finishManyPageSaves} from '@/features/canvas/store/pagePersistence';
import {isTauriDesktop} from '@/utils/tauriFiles';
type State={pages:Page[];notebookId:string|null;loading:boolean;
 load:(id:string)=>Promise<void>;cacheContent:(id:string,content:string)=>boolean;add:(afterPosition:number)=>Promise<string|undefined>;remove:(id:string)=>Promise<void>;move:(id:string,position:number)=>Promise<void>;duplicateMany:(ids:string[])=>Promise<string[]>;removeMany:(ids:string[])=>Promise<Page[]>;restoreMany:(pages:Page[])=>Promise<void>;updateTemplate:(id:string,template:PageTemplate,paperColor:PaperColor)=>Promise<void>};
const showError=(e:unknown)=>Alert.alert('Sayfa işlemi başarısız',e instanceof Error?e.message:'Tekrar dene.');
const timed=async<T>(operation:string,run:()=>Promise<T>):Promise<T>=>{if(!__DEV__)return run();const started=perfNow();try{return await run()}finally{console.log('[Notex perf] page_operation',{operation,duration_ms:Math.round((perfNow()-started)*10)/10})}};
let latestLoadRevision=0;
/**
 * One-time bridge for unsaved drafts from versions before the SQLite-only store.
 * Restore only if the SQLite value still equals the draft's original base;
 * a newer SQLite edit always wins. Old keys are removed only after verification.
 */
const migrateLegacyDrafts=async(pages:Page[]):Promise<Page[]>=>{
 if(!isTauriDesktop()||typeof window==='undefined')return pages;
 const result:Page[]=[];
 for(const page of pages){
  const key='notex:page-content:v1:'+page.id;
  try{
   const raw=window.localStorage.getItem(key);
   if(raw===null){result.push(page);continue}
   const draft=JSON.parse(raw) as {content?:unknown;base?:unknown;pending?:unknown};
   if(draft.pending!==true){window.localStorage.removeItem(key);result.push(page);continue}
   if(typeof draft.content!=='string'||typeof draft.base!=='string'){result.push(page);continue}
   if(page.content!==draft.base&&page.content!==draft.content){result.push(page);continue}
   if(page.content!==draft.content){
    await pageRepository.updateContent(page.id,draft.content);
    if(await pageRepository.getStoredContent(page.id)!==draft.content)throw new Error('Eski taslak doğrulanamadı.');
   }
   window.localStorage.removeItem(key);
   result.push({...page,content:draft.content});
  }catch(error){console.error('[Notex migration] Eski sayfa taslağı korunuyor',error);result.push(page)}
 }
 return result;
};
export const usePageStore=create<State>((set,get)=>({
 pages:[],notebookId:null,loading:false,
 load:async id=>{if(get().notebookId===id&&!get().loading&&get().pages.length>0)return;const revision=++latestLoadRevision;set({notebookId:id,loading:true,pages:[]});const started=__DEV__?perfNow():0;try{const pages=await migrateLegacyDrafts(await pageRepository.getByNotebook(id));if(get().notebookId===id&&revision===latestLoadRevision){set({pages})}if(__DEV__)console.log('[Notex perf] page_store_load',{duration_ms:Math.round((perfNow()-started)*10)/10,page_count:pages.length})}catch(e){showError(e)}finally{if(get().notebookId===id&&revision===latestLoadRevision)set({loading:false})}},
 cacheContent:(pageId,content)=>{
  const current=get().pages.find(page=>page.id===pageId);
  if(!current)return false;
  if(current.content===content)return true;
  // This is the only page-content mutation path.
  // Immediate state makes ink responsive; queued SQLite writes are serialized.
  enqueuePageSave(pageId,content);
  set(state=>({pages:state.pages.map(page=>page.id===pageId?{...page,content}:page)}));
  return true;
 },
 add:async position=>{
  const id=get().notebookId;if(!id)return;
  try{
   const created=await timed('add_write',()=>pageRepository.add(id,position));
   const added=(await pageRepository.getByIds([created]))[0];
   if(!added)throw new Error('Yeni sayfa yüklenemedi.');
   set(state=>{
    if(state.notebookId!==id)return state;
    const pages=[...state.pages,added].sort((a,b)=>a.position-b.position)
     .map((page,index)=>({...page,position:index}));
    return {pages};
   });
   await timed('add_notebook_refresh',()=>useNotebookStore.getState().refresh());
   return created;
  }catch(e){showError(e)}
 },
 remove:async pageId=>{
  const id=get().notebookId;if(!id)return;
  if(!get().pages.some(page=>page.id===pageId))return;
  try{
   await finishPageSave(pageId);
   await timed('remove_write',()=>pageRepository.remove(pageId));
   if(get().notebookId===id)set(state=>({pages:state.pages.filter(page=>page.id!==pageId).map((page,index)=>({...page,position:index}))}));
   await timed('remove_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){showError(e)}
 },
 move:async(pageId,position)=>{
  const id=get().notebookId;if(!id)return;
  if(!get().pages.some(page=>page.id===pageId))return;
  try{
   await timed('move_write',()=>pageRepository.move(pageId,position));
   if(get().notebookId===id)set(state=>{
    const current=[...state.pages];
    const currentFrom=current.findIndex(item=>item.id===pageId);
    if(currentFrom<0)return state;
    const [moved]=current.splice(currentFrom,1);
    current.splice(Math.max(0,Math.min(current.length,position)),0,moved);
    return {pages:current.map((item,index)=>({...item,position:index}))};
   });
   await timed('move_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){showError(e)}
 },
 duplicateMany:async ids=>{
  const id=get().notebookId;if(!id||!ids.length)return [];
  try{
   for(const pageId of ids)await flushPageSave(pageId);
   const created=await timed('duplicate_write',()=>pageRepository.duplicateMany(ids));
   const duplicates=await pageRepository.getByIds(created);
   set(state=>{
    if(state.notebookId!==id)return state;
    const selected=new Set(ids);
    const sorted=[...state.pages].sort((a,b)=>a.position-b.position);
    const createdBySource=new Map(sorted.filter(p=>selected.has(p.id)).map((p,i)=>[p.id,duplicates.find(d=>d.id===created[i])]));
    const pages:Page[]=[];
    for(const page of sorted){pages.push(page);const copy=createdBySource.get(page.id);if(copy)pages.push(copy)}
    return {pages:pages.map((page,index)=>({...page,position:index}))};
   });
   await timed('duplicate_notebook_refresh',()=>useNotebookStore.getState().refresh());
   return created;
  }catch(e){showError(e);return []}
 },
 removeMany:async ids=>{
  const id=get().notebookId;if(!id||!ids.length)return [];
  const selected=new Set(ids);
  if(!get().pages.some(page=>selected.has(page.id)))return [];
  try{
   await finishManyPageSaves(ids);
   const dbRemoved=await timed('remove_many_write',()=>pageRepository.removeMany(ids));
   if(get().notebookId===id)set(state=>({pages:state.pages.filter(page=>!selected.has(page.id)).map((page,index)=>({...page,position:index}))}));
   await timed('remove_many_notebook_refresh',()=>useNotebookStore.getState().refresh());
   return dbRemoved;
  }catch(e){showError(e);return []}
 },
 restoreMany:async restored=>{
  const id=get().notebookId;if(!id||!restored.length)return;
  await timed('restore_write',()=>pageRepository.restoreMany(restored));
  set(state=>{
   if(state.notebookId!==id)return state;
   const existing=new Set(state.pages.map(page=>page.id));
   const pages=[...state.pages,...restored.filter(page=>!existing.has(page.id))]
    .sort((a,b)=>a.position-b.position);
   return {pages:pages.map((page,index)=>({...page,position:index}))};
  });
  await timed('restore_notebook_refresh',()=>useNotebookStore.getState().refresh());
 },
 updateTemplate:async(pageId,template,paperColor)=>{
  const id=get().notebookId;if(!id)return;
  const previous=get().pages.find(page=>page.id===pageId);
  if(!previous)return;
  try{
   await timed('template_write',()=>pageRepository.updateTemplate(pageId,template,paperColor));
   if(get().notebookId===id)set(state=>({pages:state.pages.map(page=>page.id===pageId?{...page,template,paperColor}:page)}));
   await timed('template_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){showError(e)}
 }
}));
