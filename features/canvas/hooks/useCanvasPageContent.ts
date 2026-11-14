import {useMemo,useRef} from 'react';
import {usePageStore} from '@/store/pageStore';
import {parseContent,serializeContent} from '@/features/canvas/engine/content';
import {useAutosave} from '@/features/canvas/hooks/useAutosave';
import {record,undo,redo,historyState} from '@/features/canvas/store/history';
import type {PageContent,PageImage} from '@/features/canvas/types';

/**
 * The shared page store is the only page-content state.
 * All pen/eraser/text/shape/image edits, undo and redo commit through here.
 * useAutosave persists the same snapshot to SQLite; the store synchronously
 * stages it in Tauri localStorage for crash recovery.
 */
export function useCanvasPageContent(pageId:string,fallbackContent:string,onHistory:()=>void){
 const raw=usePageStore(s=>s.pages.find(page=>page.id===pageId)?.content??fallbackContent);
 const content=useMemo<PageContent>(()=>parseContent(raw),[raw]);
 const latest=useRef(content);
 const {error,saving,retry,flush,setDrawingActive,markChanged}=useAutosave(pageId,content);
 const commit=(next:PageContent)=>{
  latest.current=next;
  markChanged(next);
  usePageStore.getState().cacheContent(pageId,serializeContent(next));
 };
 const change=(incoming:PageContent)=>{
  const previous=latest.current;
  const previousIds=new Set(previous.elements.map(element=>element.id));
  const addedStrokes=incoming.elements.filter(element=>element.type==='stroke'&&element.tool==='pen'&&!previousIds.has(element.id));
  const isAdditivePenCommit=addedStrokes.length>0&&incoming.elements.every(element=>previousIds.has(element.id)||addedStrokes.includes(element as typeof addedStrokes[number]));
  const next=isAdditivePenCommit
   ? {...incoming,elements:[...previous.elements,...addedStrokes],h:Math.max(previous.h??0,incoming.h??0)}
   : incoming;
  record(pageId,previous);commit(next);onHistory();
 };
 const addImage=(image:PageImage)=>{
  const previous=latest.current;
  const next={...previous,images:[...(previous.images??[]),image]};
  record(pageId,previous);commit(next);onHistory();
 };
 const back=()=>{const next=undo(pageId,latest.current);if(next){commit(next);onHistory()}};
 const forward=()=>{const next=redo(pageId,latest.current);if(next){commit(next);onHistory()}};
 const h=historyState(pageId);
 return {content,change,addImage,back,forward,error,saving,retry,flush,setDrawingActive,canUndo:h.canUndo,canRedo:h.canRedo};
}
