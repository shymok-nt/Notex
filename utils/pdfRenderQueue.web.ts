import * as Crypto from 'expo-crypto';
import {getDatabase,withSafeTransaction} from '@/db/database';
import {usePageStore} from '@/store/pageStore';
import {renderPdfPage} from '@/utils/pdfImport.web';
import {deleteStoredFile,storedFileAssetUri,readStoredFile,storedFileExists} from '@/utils/tauriFiles';
import {flushPageSave} from '@/features/canvas/store/pagePersistence';
import type {PDFDocumentProxy} from 'pdfjs-dist/types/src/display/api';

type Job={id:string;notebookId:string;source:string;index:number;position:number};
type Progress={completed:number;total:number};
const jobs=new Map<string,Job>();
const cancelled=new Set<string>();
const active=new Set<string>();
const failedJobs=new Map<string,{job:Job;error:string}>();
const progress=new Map<string,Progress>();
const listeners=new Set<()=>void>();
let preferredPage:string|null=null;
let running=0;
const emit=()=>listeners.forEach(listener=>listener());
export const subscribePdfProgress=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export const getPdfProgress=(notebookId:string)=>progress.get(notebookId)??null;
export const getPdfError=(notebookId:string)=>[...failedJobs.values()].find(item=>item.job.notebookId===notebookId)?.error??null;
const yieldIdle=()=>new Promise<void>(resolve=>setTimeout(resolve,12));
const documentCache=new Map<string,Promise<PDFDocumentProxy>>();
const TIMEOUT_URL=15000,TIMEOUT_RENDER=30000;
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function deadline<T>(work:Promise<T>,ms:number,message:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})])}
 finally{if(timer)clearTimeout(timer)}
}
export const getPdfPageError=(pageId:string)=>failedJobs.get(pageId)?.error??null;
export async function releasePdfNotebook(notebookId:string){
 const sources=new Set<string>();
 for(const job of jobs.values())if(job.notebookId===notebookId)sources.add(job.source);
 const db=await getDatabase();
 const rows=await db.getAllAsync<{content:string}>('SELECT content FROM pages WHERE notebook_id=?',notebookId);
 for(const row of rows){try{const source=(JSON.parse(row.content) as {pdfSource?:{file:string}}).pdfSource?.file;if(source)sources.add(source)}catch{}}
 for(const source of sources){
  const promise=documentCache.get(source);documentCache.delete(source);
  if(promise)void promise.then(doc=>doc.destroy()).catch(()=>{});
 }
}

async function getDocument(source:string){
 let promise=documentCache.get(source);
 if(!promise){
  promise=(async()=>{
   if(!await storedFileExists(source))throw new Error('PDF kaynak dosyası bulunamadı: '+source);
   const url=storedFileAssetUri(source);
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs';
   const options={cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',iccUrl:'/pdfjs/iccs/'};
   if(url){
    const task=pdfjs.getDocument({url,...options});
    try{return await deadline(task.promise,TIMEOUT_URL,'PDF URL okuma 15 saniyede tamamlanamadı')}
    catch(error){
     console.error('[Notex PDF] URL ile okuma başarısız, yerel dosya deneniyor:',error);
     void task.destroy().catch(()=>{});
    }
   }
   const bytes=await deadline(readStoredFile(source),TIMEOUT_URL,'PDF dosyası 15 saniyede okunamadı');
   const fallback=pdfjs.getDocument({data:bytes,...options});
   try{return await deadline(fallback.promise,TIMEOUT_URL,'PDF baytlardan 15 saniyede açılamadı')}
   catch(error){void fallback.destroy().catch(()=>{});throw error}
  })();
  documentCache.set(source,promise);
  void promise.catch(error=>{if(documentCache.get(source)===promise)documentCache.delete(source);console.error('[Notex PDF] Belge açılamadı:',error)});
 }
 return promise;
}
function priority(job:Job){
 if(job.id===preferredPage)return -1000000;
 const current=preferredPage?usePageStore.getState().pages.find(page=>page.id===preferredPage):undefined;
 if(current&&current.notebookId===job.notebookId){
  const distance=Math.abs(current.position-job.position);
  return distance<=3?distance:100+distance;
 }
 return 1000+job.position;
}
async function complete(job:Job,backgroundPath:string,thumbnailPath:string){
 await flushPageSave(job.id);
 const db=await getDatabase();
 let applied=false;
 await withSafeTransaction(db,async tx=>{
  const row=await tx.getFirstAsync<{content:string}>('SELECT p.content FROM pages p JOIN notebooks n ON n.id=p.notebook_id WHERE p.id=? AND n.deleted_at IS NULL',job.id);
  if(!row)return;
  const content=JSON.parse(row.content) as {pdfSource?:{file:string;pageIndex:number};backgroundImage?:unknown;pdfPageLayout?:{x:number;y:number;width:number;height:number};[key:string]:unknown};
  if(!content.pdfSource||content.pdfSource.file!==job.source||content.pdfSource.pageIndex!==job.index||content.backgroundImage)return;
  const layout=content.pdfPageLayout;
  if(!layout)return;
  content.backgroundImage={id:Crypto.randomUUID(),uri:backgroundPath,x:layout.x,y:layout.y,width:layout.width,height:layout.height};
  await tx.runAsync('UPDATE pages SET content=?,thumbnail_path=? WHERE id=?',JSON.stringify(content),thumbnailPath,job.id);
  applied=true;
 });
 if(!applied)return false;
 usePageStore.setState(state=>({
  pages:state.pages.map(page=>{
   if(page.id!==job.id)return page;
   if(page.contentLoaded===false)return {...page,thumbnailPath};
   const content=JSON.parse(page.content) as Record<string,unknown>;
   if(content.backgroundImage)return {...page,thumbnailPath};
   const layout=content.pdfPageLayout as {x:number;y:number;width:number;height:number}|undefined;
   if(!layout)return {...page,thumbnailPath};
   return {...page,thumbnailPath,content:JSON.stringify({...content,backgroundImage:{id:Crypto.randomUUID(),uri:backgroundPath,...layout}})};
  })
 }));
 return true;
}
async function process(job:Job){
 const assets:string[]=[];
 try{
  if(cancelled.has(job.notebookId))return;
  const pdf=await getDocument(job.source);
  let rendered:Awaited<ReturnType<typeof renderPdfPage>>|undefined;
  for(let attempt=0;attempt<3;attempt++){
   try{
    rendered=await deadline(renderPdfPage(pdf,job.index+1,assets),TIMEOUT_RENDER,'PDF sayfa render işlemi 30 saniyede tamamlanamadı');
    break;
   }catch(error){
    console.error('[Notex PDF] Sayfa render hatası',job.id,'deneme',attempt+1,error);
    if(attempt===2)throw error;
    await wait(300*(attempt+1));
   }
  }
  if(!rendered)throw new Error('PDF sayfası oluşturulamadı');
  const content=JSON.parse(rendered.content) as {backgroundImage:{uri:string}};
  const backgroundPath=content.backgroundImage.uri;
  if(cancelled.has(job.notebookId))return;
  const applied=await complete(job,backgroundPath,rendered.thumbnailPath!);
  if(applied){
   const p=progress.get(job.notebookId);
   if(p){p.completed=Math.min(p.total,p.completed+1);emit()}
   assets.length=0;
  }
 }catch(error){console.error('[Notex PDF] Sayfa arka planı hazırlanamadı',job.id,error);failedJobs.set(job.id,{job,error:error instanceof Error?error.message:String(error)});emit()}
 finally{await Promise.allSettled(assets.map(path=>deleteStoredFile(path)))}
}
function pump(){
 while(running<2&&jobs.size){
  const job=[...jobs.values()].sort((a,b)=>priority(a)-priority(b))[0];
  if(!job)break;
  jobs.delete(job.id);active.add(job.id);running++;
  void (async()=>{
   try{await process(job)}finally{
    active.delete(job.id);running--;
    await yieldIdle();pump();
   }
  })();
 }
}
export async function repairPdfBackground(pageId:string){
 const db=await getDatabase();
 await flushPageSave(pageId);
 let notebookId:string|null=null;
 await withSafeTransaction(db,async tx=>{
  const row=await tx.getFirstAsync<{notebook_id:string;content:string}>('SELECT notebook_id,content FROM pages WHERE id=?',pageId);
  if(!row)return;
  const content=JSON.parse(row.content) as {pdfSource?:{file:string;pageIndex:number};backgroundImage?:{uri:string};[key:string]:unknown};
  if(!content.pdfSource)return;
  notebookId=row.notebook_id;
  delete content.backgroundImage;
  await tx.runAsync('UPDATE pages SET content=?,thumbnail_path=NULL WHERE id=?',JSON.stringify(content),pageId);
 });
 if(!notebookId)return;
 usePageStore.setState(state=>({pages:state.pages.map(page=>{
  if(page.id!==pageId)return page;
  if(page.contentLoaded===false)return {...page,thumbnailPath:null};
  const content=JSON.parse(page.content) as Record<string,unknown>;
  delete content.backgroundImage;
  return {...page,content:JSON.stringify(content),thumbnailPath:null};
 })}));
 failedJobs.delete(pageId);
 await resumePdfNotebook(notebookId);
 prioritizePdfPage(pageId);
}
export function prioritizePdfPage(pageId:string){preferredPage=pageId;const failed=failedJobs.get(pageId);if(failed){failedJobs.delete(pageId);jobs.set(pageId,failed.job)}pump()}
export function cancelPdfNotebook(notebookId:string){
 cancelled.add(notebookId);
 for(const [id,job] of jobs)if(job.notebookId===notebookId)jobs.delete(id);
 for(const [id,item] of failedJobs)if(item.job.notebookId===notebookId)failedJobs.delete(id);
 progress.delete(notebookId);emit();
}
export async function resumePdfNotebook(notebookId:string){
 cancelled.delete(notebookId);
 // Reopening a notebook is an explicit retry of pages that previously failed.
 for(const [id,item] of failedJobs)if(item.job.notebookId===notebookId)failedJobs.delete(id);
 const db=await getDatabase();
 const rows=await db.getAllAsync<{id:string;position:number;content:string}>('SELECT id,position,content FROM pages WHERE notebook_id=? ORDER BY position',notebookId);
 let total=0,completed=0;
 for(const row of rows){
  let content:{pdfSource?:{file:string;pageIndex:number};backgroundImage?:unknown};
  try{content=JSON.parse(row.content)}catch{continue}
  if(!content.pdfSource)continue;
  total++;
  if(content.backgroundImage){completed++;continue}
  if(!jobs.has(row.id)&&!active.has(row.id)&&!failedJobs.has(row.id))jobs.set(row.id,{id:row.id,notebookId,source:content.pdfSource.file,index:content.pdfSource.pageIndex,position:row.position});
 }
 if(total){progress.set(notebookId,{completed,total});emit()}
 pump();
}
