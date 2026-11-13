import { create } from 'zustand';
import { Alert } from 'react-native';
import { pageRepository } from '@/db/repositories/pageRepository';
import { useNotebookStore } from '@/store/notebookStore';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import {perfNow} from '@/features/canvas/engine/performance';
type State={pages:Page[];notebookId:string|null;loading:boolean;
 load:(id:string)=>Promise<void>;cacheContent:(id:string,content:string)=>void;add:(afterPosition:number)=>Promise<string|undefined>;remove:(id:string)=>Promise<void>;move:(id:string,position:number)=>Promise<void>;duplicateMany:(ids:string[])=>Promise<string[]>;removeMany:(ids:string[])=>Promise<Page[]>;restoreMany:(pages:Page[])=>Promise<void>;updateTemplate:(id:string,template:PageTemplate,paperColor:PaperColor)=>Promise<void>};
const showError=(e:unknown)=>Alert.alert('Sayfa işlemi başarısız',e instanceof Error?e.message:'Tekrar dene.');
const timed=async<T>(operation:string,run:()=>Promise<T>):Promise<T>=>{if(!__DEV__)return run();const started=perfNow();try{return await run()}finally{console.log('[Notex perf] page_operation',{operation,duration_ms:Math.round((perfNow()-started)*10)/10})}};
let latestLoadRevision=0;
export const usePageStore=create<State>((set,get)=>({
 pages:[],notebookId:null,loading:false,
 load:async id=>{const revision=++latestLoadRevision;set({notebookId:id,loading:true,pages:[]});const started=__DEV__?perfNow():0;try{const pages=await pageRepository.getByNotebook(id);if(get().notebookId===id&&revision===latestLoadRevision)set({pages});if(__DEV__)console.log('[Notex perf] page_store_load',{duration_ms:Math.round((perfNow()-started)*10)/10,page_count:pages.length})}catch(e){showError(e)}finally{if(get().notebookId===id&&revision===latestLoadRevision)set({loading:false})}},
 cacheContent:(pageId,content)=>set(state=>{const pageIndex=state.pages.findIndex(page=>page.id===pageId);if(pageIndex<0)return state;const pages=state.pages.slice();pages[pageIndex]={...pages[pageIndex],content};return {pages}}),
 add:async position=>{const id=get().notebookId;if(!id)return;try{const created=await timed('add_write',()=>pageRepository.add(id,position));const pages=await pageRepository.getByNotebook(id);if(get().notebookId===id)set({pages});await timed('add_notebook_refresh',()=>useNotebookStore.getState().refresh());return created}catch(e){showError(e)}},
 remove:async pageId=>{const id=get().notebookId;if(!id)return;try{await timed('remove_write',()=>pageRepository.remove(pageId));set({pages:await pageRepository.getByNotebook(id)});await timed('remove_notebook_refresh',()=>useNotebookStore.getState().refresh())}catch(e){showError(e)}},
 move:async(pageId,position)=>{const id=get().notebookId;if(!id)return;try{await timed('move_write',()=>pageRepository.move(pageId,position));set({pages:await pageRepository.getByNotebook(id)});await timed('move_notebook_refresh',()=>useNotebookStore.getState().refresh())}catch(e){showError(e)}},
 duplicateMany:async ids=>{const id=get().notebookId;if(!id||!ids.length)return [];try{const created=await timed('duplicate_write',()=>pageRepository.duplicateMany(ids));set({pages:await pageRepository.getByNotebook(id)});await timed('duplicate_notebook_refresh',()=>useNotebookStore.getState().refresh());return created}catch(e){showError(e);return []}},
 removeMany:async ids=>{const id=get().notebookId;if(!id||!ids.length)return [];try{const removed=await timed('remove_many_write',()=>pageRepository.removeMany(ids));set({pages:await pageRepository.getByNotebook(id)});await timed('remove_many_notebook_refresh',()=>useNotebookStore.getState().refresh());return removed}catch(e){showError(e);return []}},
 restoreMany:async pages=>{const id=get().notebookId;if(!id||!pages.length)return;await timed('restore_write',()=>pageRepository.restoreMany(pages));set({pages:await pageRepository.getByNotebook(id)});await timed('restore_notebook_refresh',()=>useNotebookStore.getState().refresh())},
 updateTemplate:async(pageId,template,paperColor)=>{const id=get().notebookId;if(!id)return;try{await timed('template_write',()=>pageRepository.updateTemplate(pageId,template,paperColor));set({pages:await pageRepository.getByNotebook(id)});await timed('template_notebook_refresh',()=>useNotebookStore.getState().refresh())}catch(e){showError(e)}}
}));
