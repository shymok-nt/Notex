import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {pageRepository} from '@/db/repositories/pageRepository';
import {serializeContent} from '@/features/canvas/engine/content';
import {autosaveDelay,AUTOSAVE_RETRY_DELAY_MS,canResetDirtyWindow} from '@/features/canvas/engine/autosavePolicy';
import {perfNow} from '@/features/canvas/engine/performance';
import type {PageContent} from '@/features/canvas/types';
import {logImageDebug} from '@/utils/tauriFiles';

const queues=new Map<string,Promise<void>>();
export function useAutosave(pageId:string|null,content:PageContent,onSaved?:(pageId:string,serializedContent:string)=>void){
 const [error,setError]=useState(false),[saving,setSaving]=useState(false);
 // Keep the last synchronously committed edit until React has rendered it.
 // Replacing this ref on every render can restore stale props before a page-switch flush.
 const latest=useRef({pageId,content});
 const onSavedRef=useRef(onSaved);onSavedRef.current=onSaved;
 const initialized=useRef(false),dirty=useRef(false),active=useRef(false);
 const version=useRef(0),savedVersion=useRef(0),firstDirty=useRef(0);
 const lastSerialized=useRef<string|null>(null);
 const lastCompareMs=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const statusTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const mounted=useRef(true);
 const idleWaiters=useRef<Array<()=>void>>([]);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null};
 const flush=useCallback(async()=>{
  clear();
  if(active.current)await new Promise<void>((resolve,reject)=>{
   const timeout=setTimeout(()=>{idleWaiters.current=idleWaiters.current.filter(waiter=>waiter!==done);reject(new Error('Çizim henüz tamamlanmadı. Tekrar dene.'))},3000);
   const done=()=>{clearTimeout(timeout);resolve()};
   idleWaiters.current.push(done);
  });
  const {pageId:id,content:value}=latest.current;
  if(!id||!dirty.current)return queues.get(id??'')??Promise.resolve();
  const snapshot=version.current;
  if(snapshot===savedVersion.current)return queues.get(id)??Promise.resolve();
  dirty.current=false;
  const imageIds=(value.images??[]).map(image=>image.id);
  const serializeStarted=__DEV__?perfNow():0;
  const data=serializeContent(value);
  const serializeMs=__DEV__?perfNow()-serializeStarted:0;
  const previous=queues.get(id)??Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
   if(statusTimer.current)clearTimeout(statusTimer.current);
   statusTimer.current=setTimeout(()=>{if(mounted.current)setSaving(true)},400);
   try{
    const writeStarted=__DEV__?perfNow():0;
    if(imageIds.length)logImageDebug('sqlite_save_started',{pageId:id,imageCount:imageIds.length,elementIds:imageIds});
    await pageRepository.updateContent(id,data);
    if(await pageRepository.getStoredContent(id)!==data)throw new Error('Sayfa kaydı doğrulanamadı. Tekrar dene.');
    onSavedRef.current?.(id,data);
    if(imageIds.length)logImageDebug('sqlite_save_succeeded',{pageId:id,imageCount:imageIds.length,elementIds:imageIds});
    if(__DEV__)console.log('[Notex perf] autosave_flush',{compare_ms:Math.round(lastCompareMs.current*10)/10,serialize_ms:Math.round(serializeMs*10)/10,sqlite_write_ms:Math.round((perfNow()-writeStarted)*10)/10,content_characters:data.length});
    savedVersion.current=Math.max(savedVersion.current,snapshot);
    if(canResetDirtyWindow(version.current,snapshot,dirty.current))firstDirty.current=0;
    if(mounted.current)setError(false);
   }catch(e){
    if(imageIds.length)logImageDebug('sqlite_save_failed',{pageId:id,imageCount:imageIds.length,errorType:e instanceof Error?e.name:typeof e});
    dirty.current=true;
    if(mounted.current)setError(true);
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{timer.current=null;void flush().catch(()=>{})},AUTOSAVE_RETRY_DELAY_MS);
    throw e;
   }finally{
    if(statusTimer.current)clearTimeout(statusTimer.current);
    if(mounted.current)setSaving(false);
   }
  });
  queues.set(id,task);
  void task.finally(()=>{if(queues.get(id)===task)queues.delete(id)}).catch(()=>{});
  return task;
 },[]);
 const schedule=useCallback(()=>{
  clear();if(active.current)return;
  timer.current=setTimeout(()=>{timer.current=null;void flush().catch(()=>{})},autosaveDelay(firstDirty.current,Date.now()));
 },[flush]);
 const markChanged=useCallback((next:PageContent)=>{
  latest.current={pageId,content:next};
  const serialized=serializeContent(next);
  if(serialized===lastSerialized.current)return;
  lastSerialized.current=serialized;
  version.current++;dirty.current=true;
  if(!firstDirty.current)firstDirty.current=Date.now();
  schedule();
 },[pageId,schedule]);
 // Canvas edits are committed synchronously via markChanged. The React content
 // prop can lag one render behind that commit; treating it as a new edit would
 // overwrite the latest snapshot (including erases) with stale page content.
 useEffect(()=>{
  if(!pageId)return;
  if(initialized.current)return;
  const compareStarted=__DEV__?perfNow():0;
  lastSerialized.current=serializeContent(content);
  if(__DEV__)lastCompareMs.current=perfNow()-compareStarted;
  initialized.current=true;
 },[pageId,content]);
 const setDrawingActive=useCallback((value:boolean)=>{
  active.current=value;
  if(!value){const waiters=idleWaiters.current.splice(0);waiters.forEach(resolve=>resolve())}
  if(value)clear();else if(dirty.current)schedule();
 },[schedule]);
 useEffect(()=>{
  mounted.current=true;
  const sub=AppState.addEventListener('change',state=>{
   if(state!=='active'){active.current=false;void flush().catch(()=>{})}
  });
  return()=>{mounted.current=false;sub.remove();active.current=false;idleWaiters.current.splice(0).forEach(resolve=>resolve());clear();if(statusTimer.current)clearTimeout(statusTimer.current);void flush().catch(()=>{})};
 },[flush]);
 const retry=useCallback(async()=>{active.current=false;await flush()},[flush]);
 return {flush,error,saving,retry,setDrawingActive,markChanged};
}
