import { create } from 'zustand';
import { Alert } from 'react-native';
import { pageRepository } from '@/db/repositories/pageRepository';
import { useNotebookStore } from '@/store/notebookStore';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import {perfNow} from '@/features/canvas/engine/performance';
type State={pages:Page[];notebookId:string|null;loading:boolean;
 load:(id:string)=>Promise<void>;add:(afterPosition:number)=>Promise<void>;remove:(id:string)=>Promise<void>;move:(id:string,position:number)=>Promise<void>;duplicateMany:(ids:string[])=>Promise<string[]>;removeMany:(ids:string[])=>Promise<Page[]>;restoreMany:(pages:Page[])=>Promise<void>;updateTemplate:(id:string,template:PageTemplate,paperColor:PaperColor)=>Promise<void>};
const showError=(e:unknown)=>Alert.alert('Sayfa işlemi başarısız',e instanceof Error?e.message:'Tekrar dene.');
export const usePageStore=create<State>((set,get)=>({
 pages:[],notebookId:null,loading:false,
 load:async id=>{set({notebookId:id,loading:true,pages:[]});const started=__DEV__?perfNow():0;try{const pages=await pageRepository.getByNotebook(id);if(get().notebookId===id)set({pages});if(__DEV__)console.log('[Notex perf] page_store_load',{duration_ms:Math.round((perfNow()-started)*10)/10,page_count:pages.length})}catch(e){showError(e)}finally{if(get().notebookId===id)set({loading:false})}},
 add:async position=>{const id=get().notebookId;if(!id)return;try{await pageRepository.add(id,position);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh()}catch(e){showError(e)}},
 remove:async pageId=>{const id=get().notebookId;if(!id)return;try{await pageRepository.remove(pageId);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh()}catch(e){showError(e)}},
 move:async(pageId,position)=>{const id=get().notebookId;if(!id)return;try{await pageRepository.move(pageId,position);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh()}catch(e){showError(e)}},
 duplicateMany:async ids=>{const id=get().notebookId;if(!id||!ids.length)return [];try{const created=await pageRepository.duplicateMany(ids);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh();return created}catch(e){showError(e);return []}},
 removeMany:async ids=>{const id=get().notebookId;if(!id||!ids.length)return [];try{const removed=await pageRepository.removeMany(ids);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh();return removed}catch(e){showError(e);return []}},
 restoreMany:async pages=>{const id=get().notebookId;if(!id||!pages.length)return;await pageRepository.restoreMany(pages);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh()},
 updateTemplate:async(pageId,template,paperColor)=>{const id=get().notebookId;if(!id)return;try{await pageRepository.updateTemplate(pageId,template,paperColor);set({pages:await pageRepository.getByNotebook(id)});await useNotebookStore.getState().refresh()}catch(e){showError(e)}}
}));
