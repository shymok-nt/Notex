import * as Crypto from 'expo-crypto';
import { getDatabase,withSafeTransaction } from '@/db/database';
import { copyCoverFile,deleteCoverFile,resolveCoverUri,coverPathFromUri } from '@/utils/files';
import type { NotebookDraft,PageTemplate,PaperColor } from '@/types/notebook';
import { perfNow } from '@/features/canvas/engine/performance';
import { defaultCoverColor } from '@/theme/covers';
import type { ImportedPdfPage } from '@/utils/pdfImport';
import {deleteStoredFile,isStoredAppDataPath,isTauriDesktop} from '@/utils/tauriFiles';
export type NotebookRow={
 id:string;title:string;folder_id:string|null;cover_type:'color'|'image'|'preset';cover_color:string|null;
 cover_image_path:string|null;cover_preset_id:string|null;show_title_on_cover:number;
 template:PageTemplate;paper_color:PaperColor;favorite:number;created_at:string;updated_at:string;deleted_at:string|null;page_count:number;
};
export type NotebookInput=NotebookDraft & {folderId:string|null;coverImagePath:string|null;coverPresetId?:string|null};
const select=`SELECT n.*,COUNT(p.id) AS page_count FROM notebooks n LEFT JOIN pages p ON p.notebook_id=n.id WHERE n.deleted_at IS NULL`;
const now=()=>new Date().toISOString();
const rowParams=(input:NotebookInput)=>[input.title,input.folderId,input.coverType,input.coverColor,input.coverImagePath,input.coverPresetId??null,input.showTitleOnCover?1:0,input.template,input.paperColor] as const;
const storedImagePaths=(content:string)=>{
 const paths=new Set<string>();
 try{
  const parsed=JSON.parse(content) as {images?:{uri?:string}[];backgroundImage?:{uri?:string}};
  const images=[...(Array.isArray(parsed.images)?parsed.images:[]),...(parsed.backgroundImage?[parsed.backgroundImage]:[])];
  for(const image of images){
   if(typeof image?.uri!=='string'||image.uri.startsWith('data:'))continue;
   const path=isStoredAppDataPath(image.uri)?image.uri:coverPathFromUri(image.uri);
   if(path)paths.add(path);
  }
 }catch(error){console.warn('Sayfa görsel yolları okunamadı',error)}
 return paths;
};
const removeStoredAsset=async(path:string)=>{
 if(isTauriDesktop()&&isStoredAppDataPath(path))await deleteStoredFile(path);
 else deleteCoverFile(path);
};
export const notebookRepository={
 async getAll(){const started=__DEV__?perfNow():0;const db=await getDatabase(),queryStarted=__DEV__?perfNow():0;const rows=await db.getAllAsync<NotebookRow>(`${select} GROUP BY n.id ORDER BY n.updated_at DESC`);if(__DEV__)console.log('[Notex perf] sqlite_notebooks_read',{duration_ms:Math.round((perfNow()-started)*10)/10,db_ready_ms:Math.round((queryStarted-started)*10)/10,query_ms:Math.round((perfNow()-queryStarted)*10)/10,notebook_count:rows.length});return rows;},
 async getById(id:string){const db=await getDatabase();return db.getFirstAsync<NotebookRow>(`${select} AND n.id=? GROUP BY n.id`,id);},
 async create(input:NotebookInput){
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now(),pageId=Crypto.randomUUID();
  await withSafeTransaction(db,async tx=>{
   await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,NULL)`,id,...rowParams(input),date,date);
   await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,created_at,updated_at) VALUES(?,?,0,?,?,?,?)',pageId,id,input.template,input.paperColor,date,date);
  });return id;
 },
 async createFromPdf(title:string,pages:ImportedPdfPage[]){
  if(!pages.length)throw new Error('PDF içinde sayfa bulunamadı.');
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now();
  await withSafeTransaction(db,async tx=>{
   await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,NULL,'image',?,?,'pdf-import',0,?,?,0,?,?,NULL)`,id,title,defaultCoverColor,pages[0].thumbnailPath,'boş','beyaz',date,date);
   for(let index=0;index<pages.length;index++){
    const page=pages[index];
    await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',page.id,id,index,'boş','beyaz',page.content,page.thumbnailPath,date,date);
   }
  });
  return id;
 },
 async update(id:string,patch:Partial<NotebookInput>){
  const db=await getDatabase();const before=await this.getById(id);if(!before)throw new Error('Defter bulunamadı');
  const fields:Record<string,unknown>={};
  const map:Record<string,string>={title:'title',folderId:'folder_id',coverType:'cover_type',coverColor:'cover_color',coverImagePath:'cover_image_path',coverPresetId:'cover_preset_id',showTitleOnCover:'show_title_on_cover',template:'template',paperColor:'paper_color'};
  for(const key of Object.keys(map) as (keyof NotebookInput)[]){if(key in patch)fields[map[key]]=key==='showTitleOnCover'?(patch[key]?1:0):patch[key]??null;}
  fields.updated_at=now();
  const keys=Object.keys(fields);await db.runAsync(`UPDATE notebooks SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`,...keys.map(k=>fields[k] as string|number|null),id);
  if(before.cover_image_path!==patch.coverImagePath&&patch.coverImagePath!==undefined&&before.cover_image_path){
   const used=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',before.cover_image_path);
   if(!used?.n)await removeStoredAsset(before.cover_image_path);
  }
 },
 async remove(id:string){
  const db=await getDatabase();
  await db.runAsync('UPDATE notebooks SET deleted_at=? WHERE id=? AND deleted_at IS NULL',now(),id);
 },
 async removeMany(ids:readonly string[]){
  const started=__DEV__?perfNow():0;
  const unique=[...new Set(ids.filter(id=>typeof id==='string'&&id.trim().length>0))];
  const preparedAt=__DEV__?perfNow():0;
  if(!unique.length)return [] as string[];
  const db=await getDatabase();
  const openedAt=__DEV__?perfNow():0;
  const removed=await withSafeTransaction(db,async tx=>{
   const active:string[]=[];
   for(let offset=0;offset<unique.length;offset+=500){
    const chunk=unique.slice(offset,offset+500),placeholders=chunk.map(()=>'?').join(',');
    const rows=await tx.getAllAsync<{id:string}>(`SELECT id FROM notebooks WHERE deleted_at IS NULL AND id IN (${placeholders})`,...chunk);
    active.push(...rows.map(row=>row.id));
   }
   const date=now();
   for(let offset=0;offset<active.length;offset+=500){
    const chunk=active.slice(offset,offset+500),placeholders=chunk.map(()=>'?').join(',');
    await tx.runAsync(`UPDATE notebooks SET deleted_at=? WHERE deleted_at IS NULL AND id IN (${placeholders})`,date,...chunk);
   }
   return active;
  });
  if(__DEV__)console.log('[Notex perf] notebook_bulk_remove_repository',{requested_count:ids.length,unique_count:unique.length,id_prep_ms:Math.round((preparedAt-started)*10)/10,db_open_ms:Math.round((openedAt-preparedAt)*10)/10,transaction_ms:Math.round((perfNow()-openedAt)*10)/10,moved_count:removed.length,total_ms:Math.round((perfNow()-started)*10)/10});
  return removed;
 },
 async restoreMany(ids:readonly string[]){
  const unique=[...new Set(ids.filter(id=>typeof id==='string'&&id.trim().length>0))];
  if(!unique.length)return [] as string[];
  const db=await getDatabase();
  return withSafeTransaction(db,async tx=>{
   const deleted:string[]=[];
   for(let offset=0;offset<unique.length;offset+=500){
    const chunk=unique.slice(offset,offset+500),placeholders=chunk.map(()=>'?').join(',');
    const rows=await tx.getAllAsync<{id:string}>(`SELECT id FROM notebooks WHERE deleted_at IS NOT NULL AND id IN (${placeholders})`,...chunk);
    deleted.push(...rows.map(row=>row.id));
   }
   for(let offset=0;offset<deleted.length;offset+=500){
    const chunk=deleted.slice(offset,offset+500),placeholders=chunk.map(()=>'?').join(',');
    await tx.runAsync(`UPDATE notebooks SET deleted_at=NULL,folder_id=CASE WHEN folder_id IS NULL OR EXISTS(SELECT 1 FROM folders WHERE folders.id=notebooks.folder_id) THEN folder_id ELSE NULL END WHERE deleted_at IS NOT NULL AND id IN (${placeholders})`,...chunk);
   }
   return deleted;
  });
 },
 async getDeleted(){
  const db=await getDatabase();
  return db.getAllAsync<NotebookRow>('SELECT n.*,COUNT(p.id) AS page_count FROM notebooks n LEFT JOIN pages p ON p.notebook_id=n.id WHERE n.deleted_at IS NOT NULL GROUP BY n.id ORDER BY n.deleted_at DESC');
 },
 async countDeleted(){
  const db=await getDatabase();
  const result=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE deleted_at IS NOT NULL');
  return result?.n??0;
 },
 async restore(id:string){
  const db=await getDatabase();
  await db.runAsync(`UPDATE notebooks SET deleted_at=NULL,folder_id=CASE WHEN folder_id IS NULL OR EXISTS(SELECT 1 FROM folders WHERE folders.id=notebooks.folder_id) THEN folder_id ELSE NULL END WHERE id=? AND deleted_at IS NOT NULL`,id);
 },
 async permanentlyRemove(id:string){
  const db=await getDatabase();
  const removed=await withSafeTransaction(db,async tx=>{
   const row=await tx.getFirstAsync<{cover_image_path:string|null}>('SELECT cover_image_path FROM notebooks WHERE id=? AND deleted_at IS NOT NULL',id);
   if(!row)return null;
   const owned=await tx.getAllAsync<{thumbnail_path:string|null;content:string}>('SELECT thumbnail_path,content FROM pages WHERE notebook_id=?',id);
   await tx.runAsync('DELETE FROM pages WHERE notebook_id=?',id);
   await tx.runAsync('DELETE FROM notebooks WHERE id=? AND deleted_at IS NOT NULL',id);
   return {row,pages:owned};
  });
  if(!removed)return;
  const {row,pages}=removed;
  const paths=new Set<string>();
  if(row.cover_image_path)paths.add(row.cover_image_path);
  for(const page of pages){
   if(page.thumbnail_path)paths.add(page.thumbnail_path);
   for(const path of storedImagePaths(page.content))paths.add(path);
  }
  const remaining=await db.getAllAsync<{content:string}>('SELECT content FROM pages');
  const referencedImages=new Set<string>();
  for(const page of remaining)for(const path of storedImagePaths(page.content))referencedImages.add(path);
  for(const path of paths){
   const usedCover=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',path);
   const usedThumbnail=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE thumbnail_path=?',path);
   if(!usedCover?.n&&!usedThumbnail?.n&&!referencedImages.has(path))await removeStoredAsset(path);
  }
 },
 async purgeExpired(){
  const db=await getDatabase();
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const expired=await db.getAllAsync<{id:string}>('SELECT id FROM notebooks WHERE deleted_at IS NOT NULL AND deleted_at<=?',cutoff);
  for(const row of expired){
   try{await this.permanentlyRemove(row.id)}catch(error){console.error('Silinen defter temizlenemedi',row.id,error)}
  }
 },
 async duplicate(id:string){
  const db=await getDatabase(),original=await this.getById(id);if(!original)throw new Error('Defter bulunamadı');
  const newId=Crypto.randomUUID(),date=now();
  const newPath=original.cover_image_path?await copyCoverFile(resolveCoverUri(original.cover_image_path)!):null;
  try{
   await withSafeTransaction(db,async tx=>{
    await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,newId,original.title+' kopyası',original.folder_id,original.cover_type,original.cover_color,newPath,original.cover_preset_id,original.show_title_on_cover,original.template,original.paper_color,original.favorite,date,date);
    const pages=await tx.getAllAsync<{position:number;template:string;paper_color:string;content:string;thumbnail_path:string|null}>('SELECT position,template,paper_color,content,thumbnail_path FROM pages WHERE notebook_id=? ORDER BY position',id);
    for(const page of pages)await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',Crypto.randomUUID(),newId,page.position,page.template,page.paper_color,page.content,null,date,date);
   });return newId;
  }catch(e){deleteCoverFile(newPath);throw e}
 },
 async moveToFolder(id:string,folderId:string|null){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET folder_id=? WHERE id=? AND deleted_at IS NULL',folderId,id)},
 async toggleFavorite(id:string){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET favorite=CASE favorite WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=? AND deleted_at IS NULL',now(),id);}
};
