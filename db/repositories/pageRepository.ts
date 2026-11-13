import * as Crypto from 'expo-crypto';
import {Directory,File,Paths} from 'expo-file-system';
import {deleteCoverFile} from '@/utils/files';
import { getDatabase,withSafeTransaction } from '@/db/database';
import type { Page } from '@/types/page';
import type { PageTemplate,PaperColor } from '@/types/notebook';
import {perfNow} from '@/features/canvas/engine/performance';
import {copyStoredFile,isTauriDesktop} from '@/utils/tauriFiles';
type PageRow={id:string;notebook_id:string;position:number;template:PageTemplate;paper_color:PaperColor;content:string;thumbnail_path:string|null;created_at:string;updated_at:string};
const convert=(r:PageRow):Page=>({id:r.id,notebookId:r.notebook_id,position:r.position,template:r.template,paperColor:r.paper_color,content:r.content,thumbnailPath:r.thumbnail_path,createdAt:r.created_at,updatedAt:r.updated_at});
export type RecentPageRecord={page:Page;notebookTitle:string};
const now=()=>new Date().toISOString();
export const pageRepository={
 async getByNotebook(notebookId:string){const started=__DEV__?perfNow():0;const db=await getDatabase(),queryStarted=__DEV__?perfNow():0;const rows=await db.getAllAsync<PageRow>('SELECT * FROM pages WHERE notebook_id=? AND EXISTS(SELECT 1 FROM notebooks WHERE id=? AND deleted_at IS NULL) ORDER BY position',notebookId,notebookId);const queryFinished=__DEV__?perfNow():0;const pages=rows.map(convert);if(__DEV__)console.log('[Notex perf] sqlite_pages_read',{duration_ms:Math.round((perfNow()-started)*10)/10,db_ready_ms:Math.round((queryStarted-started)*10)/10,query_ms:Math.round((queryFinished-queryStarted)*10)/10,map_ms:Math.round((perfNow()-queryFinished)*10)/10,page_count:pages.length,content_characters:pages.reduce((total,page)=>total+page.content.length,0)});return pages;},
 async getRecentAcrossNotebooks(limit=5):Promise<RecentPageRecord[]>{const started=__DEV__?perfNow():0;const db=await getDatabase();const safeLimit=Math.max(0,Math.floor(Number.isFinite(limit)?limit:5));const rows=await db.getAllAsync<PageRow&{notebook_title:string}>('SELECT p.*,n.title AS notebook_title FROM pages p INNER JOIN notebooks n ON n.id=p.notebook_id WHERE n.deleted_at IS NULL ORDER BY p.updated_at DESC LIMIT ?',safeLimit);const pages=rows.map(({notebook_title,...row})=>({page:convert(row),notebookTitle:notebook_title}));if(__DEV__)console.log('[Notex perf] recent_pages_read',{duration_ms:Math.round((perfNow()-started)*10)/10,page_count:pages.length,content_characters:pages.reduce((total,item)=>total+item.page.content.length,0)});return pages;},
 async add(notebookId:string,afterPosition?:number){
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now();
  await withSafeTransaction(db,async tx=>{
   const notebook=await tx.getFirstAsync<{template:PageTemplate;paper_color:PaperColor}>('SELECT template,paper_color FROM notebooks WHERE id=? AND deleted_at IS NULL',notebookId);
   if(!notebook)throw new Error('Defter bulunamadı');
   const source=afterPosition===undefined?null:await tx.getFirstAsync<{template:PageTemplate;paper_color:PaperColor}>('SELECT template,paper_color FROM pages WHERE notebook_id=? AND position=?',notebookId,afterPosition);
   const count=await tx.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',notebookId);
   const position=afterPosition===undefined?count!.n:Math.max(0,Math.min(count!.n,afterPosition+1));
   await tx.runAsync('UPDATE pages SET position=position+1 WHERE notebook_id=? AND position>=?',notebookId,position);
   await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,notebookId,position,source?.template??notebook.template,source?.paper_color??notebook.paper_color,date,date);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',date,notebookId);
  });return id;
 },
 async remove(pageId:string){
  const db=await getDatabase();await withSafeTransaction(db,async tx=>{
   const row=await tx.getFirstAsync<{notebook_id:string}>('SELECT notebook_id FROM pages WHERE id=?',pageId);if(!row)throw new Error('Sayfa bulunamadı');
   const count=await tx.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',row.notebook_id);
   if((count?.n??0)<=1)throw new Error('Defterin son sayfası silinemez');
   await tx.runAsync('DELETE FROM pages WHERE id=?',pageId);
   const remaining=await tx.getAllAsync<{id:string}>('SELECT id FROM pages WHERE notebook_id=? ORDER BY position',row.notebook_id);
   for(let i=0;i<remaining.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,remaining[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',now(),row.notebook_id);
  });
 },
 async move(pageId:string,newPosition:number){
  const db=await getDatabase();await withSafeTransaction(db,async tx=>{
   const row=await tx.getFirstAsync<{notebook_id:string}>('SELECT notebook_id FROM pages WHERE id=?',pageId);if(!row)throw new Error('Sayfa bulunamadı');
   const pages=await tx.getAllAsync<{id:string}>('SELECT id FROM pages WHERE notebook_id=? ORDER BY position',row.notebook_id);
   const from=pages.findIndex(p=>p.id===pageId);if(from<0)return;
   const [item]=pages.splice(from,1);pages.splice(Math.max(0,Math.min(pages.length,newPosition)),0,item);
   for(let i=0;i<pages.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,pages[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',now(),row.notebook_id);
  });
 },

 async duplicateMany(ids:string[]){
  const db=await getDatabase(),date=now(),created:string[]=[],copiedPaths:string[]=[];
  const duplicateFile=async(relative:string|null)=>{
   if(!relative)return null;
   if(isTauriDesktop()){
    const path=await copyStoredFile(relative,'page-assets');copiedPaths.push(path);return path;
   }
   const source=new File(Paths.document,relative);
   if(!source.exists)throw new Error('Kopyalanacak görsel bulunamadı');
   const extension=source.extension||'.png';
   const path='page-assets/'+Crypto.randomUUID()+extension;
   const dest=new File(Paths.document,path);
   new Directory(Paths.document,'page-assets').create({idempotent:true,intermediates:true});
   source.copy(dest);copiedPaths.push(path);
   return path;
  };
  try{
   await withSafeTransaction(db,async tx=>{
    const all=await tx.getAllAsync<PageRow>('SELECT * FROM pages WHERE notebook_id=(SELECT notebook_id FROM pages WHERE id=?) ORDER BY position',ids[0]);
    const selected=new Set(ids),ordered=all.filter(p=>selected.has(p.id));
    if(ordered.length!==selected.size)throw new Error('Seçili sayfalar bulunamadı');
    const notebookId=all[0]?.notebook_id;
    if(!notebookId)return;
    const result: {id:string;position:number;source?:PageRow}[]=[];
    for(const page of all){
     result.push({id:page.id,position:result.length});
     if(selected.has(page.id))result.push({id:Crypto.randomUUID(),position:result.length,source:page});
    }
    for(const item of result){
     if(!item.source)continue;
     const source=item.source;
     const content=JSON.parse(source.content) as {elements?:{id:string}[];images?:{id:string;uri:string}[]};
     if(Array.isArray(content.elements))content.elements=content.elements.map(e=>({...e,id:Crypto.randomUUID()}));
     if(Array.isArray(content.images))content.images=content.images.map(image=>({...image,id:Crypto.randomUUID()}));
     const thumbnail=await duplicateFile(source.thumbnail_path);
     await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',item.id,notebookId,item.position,source.template,source.paper_color,JSON.stringify(content),thumbnail,date,date);
     created.push(item.id);
    }
    for(const item of result)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',item.position,item.id);
    await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',date,notebookId);
   });
   return created;
  }catch(error){for(const path of copiedPaths)deleteCoverFile(path);throw error}
 },
 async removeMany(ids:string[]){
  const db=await getDatabase(),date=now();
  return withSafeTransaction(db,async tx=>{
   const rows=await tx.getAllAsync<PageRow>('SELECT * FROM pages WHERE notebook_id=(SELECT notebook_id FROM pages WHERE id=?) ORDER BY position',ids[0]);
   const selected=new Set(ids),removed=rows.filter(p=>selected.has(p.id));
   if(removed.length!==selected.size)throw new Error('Seçili sayfalar bulunamadı');
   if(removed.length>=rows.length)throw new Error('Defterde en az bir sayfa olmalı');
   for(const page of removed)await tx.runAsync('DELETE FROM pages WHERE id=?',page.id);
   const rest=rows.filter(p=>!selected.has(p.id));
   for(let i=0;i<rest.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,rest[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',date,rows[0].notebook_id);
   return removed.map(convert);
  });
 },
 async restoreMany(pages:Page[]){
  if(!pages.length)return;
  const db=await getDatabase(),date=now(),notebookId=pages[0].notebookId;
  await withSafeTransaction(db,async tx=>{
   const existing=await tx.getAllAsync<{id:string;position:number}>('SELECT id,position FROM pages WHERE notebook_id=? ORDER BY position',notebookId);
   const entries=[...existing.map(p=>({id:p.id,position:p.position,restored:false})),...pages.map(p=>({id:p.id,position:p.position,restored:true}))];
   entries.sort((a,b)=>a.position-b.position||(a.restored?-1:1));
   for(const page of pages)await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',page.id,page.notebookId,page.position,page.template,page.paperColor,page.content,page.thumbnailPath,page.createdAt,page.updatedAt);
   for(let i=0;i<entries.length;i++)await tx.runAsync('UPDATE pages SET position=? WHERE id=?',i,entries[i].id);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=?',date,notebookId);
  });
 },
 async updateContent(pageId:string,content:string){const db=await getDatabase(),date=now();await withSafeTransaction(db,async tx=>{await tx.runAsync('UPDATE pages SET content=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM notebooks WHERE notebooks.id=pages.notebook_id AND notebooks.deleted_at IS NULL)',content,date,pageId);await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=(SELECT notebook_id FROM pages WHERE id=?)',date,pageId)})},
 async updateTemplate(pageId:string,template:PageTemplate,paperColor:PaperColor){
  const db=await getDatabase(),date=now();await withSafeTransaction(db,async tx=>{
   await tx.runAsync('UPDATE pages SET template=?,paper_color=?,updated_at=? WHERE id=?',template,paperColor,date,pageId);
   await tx.runAsync('UPDATE notebooks SET updated_at=? WHERE id=(SELECT notebook_id FROM pages WHERE id=?)',date,pageId);
  });
 }
};
