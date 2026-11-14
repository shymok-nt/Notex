import {useCallback,useMemo,useRef,useSyncExternalStore} from 'react';
import {usePageStore} from '@/store/pageStore';
import {parseContent,serializeContent} from '@/features/canvas/engine/content';
import {flushPageSave,getPageSaveStatus,subscribePageSave} from '@/features/canvas/store/pagePersistence';
import {record,undo,redo,historyState} from '@/features/canvas/store/history';
import type {Element,PageContent,PageImage} from '@/features/canvas/types';

function reconcileById<T extends {id:string}>(base:T[],incoming:T[],latest:T[]):T[]{
 const original=new Map(base.map(item=>[item.id,item]));
 const changed=new Map(incoming.filter(item=>original.has(item.id)&&JSON.stringify(original.get(item.id))!==JSON.stringify(item)).map(item=>[item.id,item]));
 const kept=new Set(incoming.map(item=>item.id));
 const updated=latest.filter(item=>!original.has(item.id)||kept.has(item.id)).map(item=>changed.get(item.id)??item);
 const ids=new Set(updated.map(item=>item.id));
 for(const item of incoming){
  if(!original.has(item.id)&&!ids.has(item.id)){updated.push(item);ids.add(item.id)}
 }
 return updated;
}
/** One store owns every page; the canvas has no independent note array. */
export function useCanvasPageContent(pageId:string,fallbackContent:string,onHistory:()=>void){
 const serialized=usePageStore(s=>s.pages.find(page=>page.id===pageId)?.content??fallbackContent);
 const content=useMemo<PageContent>(()=>parseContent(serialized),[serialized]);
 const latest=useRef(content);
 const drawing=useRef(false);
 const idleWaiters=useRef<Array<()=>void>>([]);
 const subscribe=useCallback((listener:()=>void)=>subscribePageSave(pageId,listener),[pageId]);
 const getSnapshot=useCallback(()=>getPageSaveStatus(pageId),[pageId]);
 const status=useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
 const commit=(next:PageContent):boolean=>{
  // The shared store publishes immediately for smooth drawing; SQLite is the
  // sole persistent source, using a per-page serialized queue.
  if(!usePageStore.getState().cacheContent(pageId,serializeContent(next)))return false;
  latest.current=next;
  return true;
 };
 const change=(incoming:PageContent)=>{
  const previous=latest.current;
  // Incoming edits can use an older render snapshot. Apply their exact
  // additions, deletions and modifications to the latest committed content
  // instead of resurrecting strokes or overwriting a completed erase.
  const next:PageContent={
   ...previous,
   elements:reconcileById<Element>(content.elements,incoming.elements,previous.elements),
   images:reconcileById<PageImage>(content.images??[],incoming.images??[],previous.images??[]),
   ...(incoming.h!==content.h?{h:incoming.h}:{})
  };
  if(serializeContent(previous)===serializeContent(next))return;
  if(commit(next)){record(pageId,previous);onHistory()}
 };
 const addImage=(image:PageImage)=>{
  const previous=latest.current;
  const next={...previous,images:[...(previous.images??[]),image]};
  if(commit(next)){record(pageId,previous);onHistory()}
 };
 const back=()=>{const next=undo(pageId,latest.current);if(next&&commit(next))onHistory()};
 const forward=()=>{const next=redo(pageId,latest.current);if(next&&commit(next))onHistory()};
 const setDrawingActive=(active:boolean)=>{
  drawing.current=active;
  if(!active)idleWaiters.current.splice(0).forEach(resolve=>resolve());
 };
 const flush=async()=>{
  if(drawing.current){
   await new Promise<void>((resolve,reject)=>{
    const done=()=>{clearTimeout(timeout);resolve()};
    const timeout=setTimeout(()=>{
     idleWaiters.current=idleWaiters.current.filter(item=>item!==done);
     reject(new Error('Çizim işlemi tamamlanmadan sayfa değiştirilemez.'));
    },3000);
    idleWaiters.current.push(done);
   });
  }
  await flushPageSave(pageId);
 };
 const retry=async()=>{await flush()};
 const h=historyState(pageId);
 return {content,change,addImage,back,forward,flush,retry,setDrawingActive,
  error:status==='error',saving:status==='saving',canUndo:h.canUndo,canRedo:h.canRedo};
}
