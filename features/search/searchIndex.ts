import {getDatabase} from '@/db/database';
import {parseContent} from '@/features/canvas/engine/content';
type Row={id:string;notebook_id:string;position:number;content:string;updated_at:string;search_text:string|null;extractable:number|null};
export type IndexedPage={pageId:string;notebookId:string;position:number;text:string;pdfText:string;extractable:boolean;updatedAt:string};
export type SearchHit={page:IndexedPage;source:'text'|'pdf'|'title'|'course'|'topic';preview:string;before:string;match:string;after:string};
const pages=new Map<string,IndexedPage>();
let hydrated:Promise<void>|null=null;
const pending=new Map<string,ReturnType<typeof setTimeout>>();
/** Locale-insensitive Turkish folding; preserves digits and plain Latin. */
export function normalizeSearch(value:string):string{
 return value.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
}
function textFromPage(raw:string):string{
 const content=parseContent(raw);
 return content.elements.filter(e=>e.type==='text').map(e=>e.type==='text'?e.text:'').filter(text=>text!==undefined).join(' ');
}
export async function hydrateSearchIndex(){
 if(hydrated)return hydrated;
 const promise=(async()=>{
  const db=await getDatabase();
  const rows=await db.getAllAsync<Row>(`SELECT p.id,p.notebook_id,p.position,p.content,p.updated_at,
   i.search_text,i.extractable FROM pages p
   JOIN notebooks n ON n.id=p.notebook_id AND n.deleted_at IS NULL
   LEFT JOIN pdf_search_index i ON i.page_id=p.id`);
  pages.clear();
  for(const row of rows)pages.set(row.id,{pageId:row.id,notebookId:row.notebook_id,position:row.position,text:textFromPage(row.content),pdfText:row.search_text??'',extractable:row.extractable===1,updatedAt:row.updated_at});
 })();
 hydrated=promise;
 try{await promise}catch(error){hydrated=null;throw error}
}
/** Only reindex the modified page, and never block the drawing gesture. */
export function queueIndexedPageChange(id:string,raw:string){
 const timer=pending.get(id);if(timer!==undefined)clearTimeout(timer);
 pending.set(id,setTimeout(()=>{
  pending.delete(id);
  const existing=pages.get(id);
  if(existing)pages.set(id,{...existing,text:textFromPage(raw),updatedAt:new Date().toISOString()});
 },200));
}
export function removeIndexedPages(ids:string[]){
 for(const id of ids){const timer=pending.get(id);if(timer!==undefined)clearTimeout(timer);pending.delete(id);pages.delete(id)}
}
export function clearSearchIndex(){for(const t of pending.values())clearTimeout(t);pending.clear();hydrated=null;pages.clear()}
function excerpt(text:string,needle:string){
 const matchAt=normalizeSearch(text).indexOf(needle);
 if(matchAt<0)return {preview:'',before:'',match:'',after:''};
 const left=Math.max(0,matchAt-44),right=Math.min(text.length,matchAt+needle.length+65);
 const before=(left>0?'…':'')+text.slice(left,matchAt);
 const match=text.slice(matchAt,matchAt+needle.length);
 const after=text.slice(matchAt+needle.length,right)+(right<text.length?'…':'');
 return {preview:before+match+after,before,match,after};
}
export function searchIndexedPages(query:string,metadata:Map<string,{title:string;courseName?:string;topicName?:string;courseId:string|null}>,onlyCourseId?:string|null):SearchHit[]{
 const normalized=normalizeSearch(query.trim());
 if(normalized==='')return [];
 const found:SearchHit[]=[];
 for(const page of pages.values()){
  const note=metadata.get(page.notebookId);
  if(!note)continue;
  if(onlyCourseId!==undefined&&note.courseId!==onlyCourseId)continue;
  const sources:[SearchHit['source'],string][]=[
   ['title',note.title],['course',note.courseName??''],['topic',note.topicName??''],
   ['text',page.text],['pdf',page.pdfText]
  ];
  const source=sources.find(([,text])=>normalizeSearch(text).includes(normalized));
  if(!source)continue;
  found.push({page,source:source[0],...excerpt(source[1],normalized)});
 }
 found.sort((a,b)=>b.page.updatedAt.localeCompare(a.page.updatedAt));
 return found;
}
export function getIndexedPageCount(){return pages.size}
