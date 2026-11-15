import * as Crypto from 'expo-crypto';
import {getDatabase,withSafeTransaction} from '@/db/database';
import {pageRepository} from '@/db/repositories/pageRepository';
import {usePageStore} from '@/store/pageStore';
import {renderPdfPage} from '@/utils/pdfImport.web';
import {deleteStoredFile,storedFileAssetUri,readStoredFile} from '@/utils/tauriFiles';
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
async function getDocument(source:string){
 let promise=documentCache.get(source);
 if(!promise){
  promise=(async()=>{
   const url=storedFileAssetUri(source);
   if(!url)throw Error('PDF kaynağı bulunamadı.');
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
   pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs';
   const options={cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',iccUrl:'/pdfjs/iccs/'};
   try{
    return await pdfjs.getDocument({url,...options}).promise;
   }catch(urlError){
    // Tauri's asset protocol does not always support pdf.js range/stream requests.
    // Fall back to one source read rather than leaving every page permanently white.
    console.warn('[Notex PDF] Asset URL failed; using local PDF bytes',urlError);
    const bytes=await readStoredFile(source);
    return pdfjs.getDocument({data:bytes,...options}).promise;
   }
  })();
  documentCache.set(source,promise);
  void promise.catch(()=>documentCache.delete(source));
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
  const rendered=await renderPdfPage(pdf,job.index+1,assets);
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
export function prioritizePdfPage(pageId:string){preferredPage=pageId;const failed=failedJobs.get(pageId);if(failed){failedJobs.delete(pageId);jobs.set(pageId,failed.job)}pump()}
export function cancelPdfNotebook(notebookId:string){
 cancelled.add(notebookId);
 for(const [id,job] of jobs)if(job.notebookId===notebookId)jobs.delete(id);
 for(const [id,item] of failedJobs)if(item.job.notebookId===notebookId)failedJobs.delete(id);
 progress.delete(notebookId);emit();
}
export async function resumePdfNotebook(notebookId:string){
 cancelled.delete(notebookId);
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
