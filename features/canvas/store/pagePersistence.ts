import {pageRepository} from '@/db/repositories/pageRepository';

export type PageSaveStatus='saved'|'saving'|'error';
type Entry={
 latest:string;
 version:number;
 savedVersion:number;
 job:Promise<void>|null;
 timer:ReturnType<typeof setTimeout>|null;
 status:PageSaveStatus;
 listeners:Set<()=>void>;
};
const entries=new Map<string,Entry>();
const RETRY_MS=5000;
export const SAVE_DEBOUNCE_MS=500;
const entry=(id:string):Entry=>{
 let current=entries.get(id);
 if(!current){
  current={latest:'',version:0,savedVersion:0,job:null,timer:null,status:'saved',listeners:new Set()};
  entries.set(id,current);
 }
 return current;
};
const status=(e:Entry,next:PageSaveStatus)=>{
 if(e.status===next)return;
 e.status=next;
 for(const listener of e.listeners)listener();
};
const clear=(e:Entry)=>{
 if(e.timer!==null)clearTimeout(e.timer);
 e.timer=null;
};
const schedule=(id:string,ms:number)=>{
 const e=entry(id);
 clear(e);
 e.timer=setTimeout(()=>{
  e.timer=null;
  void flushPageSave(id).catch(()=>{
   // Keep the newest snapshot pending and retry; never claim it was saved.
   if(entries.get(id)===e&&e.version>e.savedVersion)schedule(id,RETRY_MS);
  });
 },ms);
};
/** One writer per page; all edits, including an empty elements array, use this path. */
export function enqueuePageSave(id:string,serialized:string){
 const e=entry(id);
 if(e.version>e.savedVersion&&e.latest===serialized)return;
 e.latest=serialized;
 e.version++;
 status(e,'saving');
 schedule(id,SAVE_DEBOUNCE_MS);
}
/** Await every edit, including edits queued while a previous write was running. */
export async function flushPageSave(id:string):Promise<void>{
 const e=entries.get(id);
 if(!e)return;
 clear(e);
 while(e.savedVersion<e.version){
  if(!e.job){
   const snapshot=e.latest,version=e.version;
   const job=(async()=>{
    try{
     await pageRepository.updateContent(id,snapshot);
     const stored=await pageRepository.getStoredContent(id);
     if(stored!==snapshot)throw new Error('SQLite sayfa kaydı doğrulanamadı.');
     e.savedVersion=Math.max(e.savedVersion,version);
     if(e.savedVersion===e.version)status(e,'saved');
    }catch(error){
     status(e,'error');
     throw error;
    }
   })();
   e.job=job.finally(()=>{e.job=null});
  }
  await e.job;
 }
}
export function getPageSaveStatus(id:string):PageSaveStatus{
 return entries.get(id)?.status??'saved';
}
export function subscribePageSave(id:string,listener:()=>void){
 const e=entry(id);
 e.listeners.add(listener);
 return ()=>{e.listeners.delete(listener)};
}
/** Dispose a page only after its final write; don't create zombie writes. */
export async function finishPageSave(id:string){
 await flushPageSave(id);
 const e=entries.get(id);
 if(e){clear(e);entries.delete(id)}
}
export async function finishManyPageSaves(ids:string[]){
 for(const id of ids)await finishPageSave(id);
}

/** Compact save indicator; no fullscreen loading overlay for edits. */
export function visibleSaveStatus(error:boolean,saving:boolean):'error'|'saving'|null{
 return error?'error':saving?'saving':null;
}
