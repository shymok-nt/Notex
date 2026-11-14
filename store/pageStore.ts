import { create } from 'zustand';
import { Alert } from 'react-native';
import { pageRepository } from '@/db/repositories/pageRepository';
import { useNotebookStore } from '@/store/notebookStore';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import {perfNow} from '@/features/canvas/engine/performance';
import {stagePageContent,pendingPageContent,confirmPageContent,discardPageContent} from '@/features/canvas/store/pageContentStorage';
type State={pages:Page[];notebookId:string|null;loading:boolean;
 load:(id:string)=>Promise<void>;cacheContent:(id:string,content:string)=>void;add:(afterPosition:number)=>Promise<string|undefined>;remove:(id:string)=>Promise<void>;move:(id:string,position:number)=>Promise<void>;duplicateMany:(ids:string[])=>Promise<string[]>;removeMany:(ids:string[])=>Promise<Page[]>;restoreMany:(pages:Page[])=>Promise<void>;updateTemplate:(id:string,template:PageTemplate,paperColor:PaperColor)=>Promise<void>};
const showError=(e:unknown)=>Alert.alert('Sayfa işlemi başarısız',e instanceof Error?e.message:'Tekrar dene.');
const timed=async<T>(operation:string,run:()=>Promise<T>):Promise<T>=>{if(!__DEV__)return run();const started=perfNow();try{return await run()}finally{console.log('[Notex perf] page_operation',{operation,duration_ms:Math.round((perfNow()-started)*10)/10})}};
let latestLoadRevision=0;
// Reconcile only unapplied local drafts. SQLite remains the durable source.
const recoverPages=async(pages:Page[]):Promise<Page[]>=>{
 const result:Page[]=[];
 for(const page of pages){
  const pending=pendingPageContent(page.id,page.content);
  if(pending===null||pending===page.content){
   if(pending===page.content)confirmPageContent(page.id,pending);
   result.push(page);continue;
  }
  await pageRepository.updateContent(page.id,pending);
  if(await pageRepository.getStoredContent(page.id)!==pending)throw new Error('Yerel sayfa kurtarma kaydı doğrulanamadı.');
  confirmPageContent(page.id,pending);
  result.push({...page,content:pending});
 }
 return result;
};
export const usePageStore=create<State>((set,get)=>({
 pages:[],notebookId:null,loading:false,
 load:async id=>{const revision=++latestLoadRevision;set({notebookId:id,loading:true,pages:[]});const started=__DEV__?perfNow():0;try{const pages=await recoverPages(await pageRepository.getByNotebook(id));if(get().notebookId===id&&revision===latestLoadRevision){set({pages})}if(__DEV__)console.log('[Notex perf] page_store_load',{duration_ms:Math.round((perfNow()-started)*10)/10,page_count:pages.length})}catch(e){showError(e)}finally{if(get().notebookId===id&&revision===latestLoadRevision)set({loading:false})}},
 cacheContent:(pageId,content)=>set(state=>{const pageIndex=state.pages.findIndex(page=>page.id===pageId);if(pageIndex<0||state.pages[pageIndex].content===content)return state;stagePageContent(pageId,content,state.pages[pageIndex].content);const pages=state.pages.slice();pages[pageIndex]={...pages[pageIndex],content};return {pages}}),
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
  const removed=get().pages.find(page=>page.id===pageId);
  if(!removed)return;
  set(state=>({pages:state.pages.filter(page=>page.id!==pageId).map((page,index)=>({...page,position:index}))}));
  try{
   await timed('remove_write',()=>pageRepository.remove(pageId));
   discardPageContent(pageId);
   await timed('remove_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){
   set(state=>({pages:[...state.pages.filter(page=>page.id!==pageId),removed]
    .sort((a,b)=>a.position-b.position).map((page,index)=>({...page,position:index}))}));
   showError(e);
  }
 },
 move:async(pageId,position)=>{
  const id=get().notebookId;if(!id)return;
  const previous=get().pages;
  const from=previous.findIndex(page=>page.id===pageId);
  if(from<0)return;
  const pages=[...previous];
  const [page]=pages.splice(from,1);
  const target=Math.max(0,Math.min(pages.length,position));
  pages.splice(target,0,page);
  set({pages:pages.map((p,index)=>({...p,position:index}))});
  try{
   await timed('move_write',()=>pageRepository.move(pageId,position));
   await timed('move_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){
   set(state=>({pages:state.pages.map(page=>{
    const old=previous.find(p=>p.id===page.id);
    return old?{...page,position:old.position}:page;
   }).sort((a,b)=>a.position-b.position)}));
   showError(e);
  }
 },
 duplicateMany:async ids=>{
  const id=get().notebookId;if(!id||!ids.length)return [];
  try{
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
  const removed=get().pages.filter(page=>selected.has(page.id));
  if(!removed.length)return [];
  set(state=>({pages:state.pages.filter(page=>!selected.has(page.id)).map((page,index)=>({...page,position:index}))}));
  try{
   const dbRemoved=await timed('remove_many_write',()=>pageRepository.removeMany(ids));
   ids.forEach(discardPageContent);
   await timed('remove_many_notebook_refresh',()=>useNotebookStore.getState().refresh());
   return dbRemoved;
  }catch(e){
   set(state=>({pages:[...state.pages.filter(p=>!selected.has(p.id)),...removed]
    .sort((a,b)=>a.position-b.position).map((page,index)=>({...page,position:index}))}));
   showError(e);return [];
  }
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
  set(state=>({pages:state.pages.map(page=>page.id===pageId?{...page,template,paperColor}:page)}));
  try{
   await timed('template_write',()=>pageRepository.updateTemplate(pageId,template,paperColor));
   await timed('template_notebook_refresh',()=>useNotebookStore.getState().refresh());
  }catch(e){
   set(state=>({pages:state.pages.map(page=>page.id===pageId?{...page,template:previous.template,paperColor:previous.paperColor}:page)}));
   showError(e);
  }
 }
}));
