import * as Crypto from 'expo-crypto';
import { getDatabase,withSafeTransaction } from '@/db/database';
import { copyCoverFile,deleteCoverFile,resolveCoverUri,coverPathFromUri } from '@/utils/files';
import type { NotebookDraft,PageTemplate,PaperColor,ConversionFont } from '@/types/notebook';
export type NotebookRow={
 id:string;title:string;folder_id:string|null;cover_type:'color'|'image'|'preset';cover_color:string|null;
 cover_image_path:string|null;cover_preset_id:string|null;show_title_on_cover:number;
 template:PageTemplate;paper_color:PaperColor;favorite:number;auto_convert_enabled:number;conversion_font:ConversionFont;conversion_delay_ms:number;created_at:string;updated_at:string;deleted_at:string|null;page_count:number;
};
export type NotebookInput=NotebookDraft & {folderId:string|null;coverImagePath:string|null;coverPresetId?:string|null};
const select=`SELECT n.*,COUNT(p.id) AS page_count FROM notebooks n LEFT JOIN pages p ON p.notebook_id=n.id WHERE n.deleted_at IS NULL`;
const now=()=>new Date().toISOString();
const rowParams=(input:NotebookInput)=>[input.title,input.folderId,input.coverType,input.coverColor,input.coverImagePath,input.coverPresetId??null,input.showTitleOnCover?1:0,input.template,input.paperColor,input.autoConvertEnabled?1:0,input.conversionFont,input.conversionDelayMs] as const;
export const notebookRepository={
 async getAll(){const db=await getDatabase();return db.getAllAsync<NotebookRow>(`${select} GROUP BY n.id ORDER BY n.updated_at DESC`);},
 async getById(id:string){const db=await getDatabase();return db.getFirstAsync<NotebookRow>(`${select} AND n.id=? GROUP BY n.id`,id);},
 async create(input:NotebookInput){
  const db=await getDatabase(),id=Crypto.randomUUID(),date=now(),pageId=Crypto.randomUUID();
  await withSafeTransaction(db,async tx=>{
   await tx.runAsync(`INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,auto_convert_enabled,conversion_font,conversion_delay_ms,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,NULL)`,id,...rowParams(input),date,date);
   await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,created_at,updated_at) VALUES(?,?,0,?,?,?,?)',pageId,id,input.template,input.paperColor,date,date);
  });return id;
 },
 async update(id:string,patch:Partial<NotebookInput>){
  const db=await getDatabase();const before=await this.getById(id);if(!before)throw new Error('Defter bulunamadı');
  const fields:Record<string,unknown>={};
  const map:Record<string,string>={title:'title',folderId:'folder_id',coverType:'cover_type',coverColor:'cover_color',coverImagePath:'cover_image_path',coverPresetId:'cover_preset_id',showTitleOnCover:'show_title_on_cover',template:'template',paperColor:'paper_color',autoConvertEnabled:'auto_convert_enabled',conversionFont:'conversion_font',conversionDelayMs:'conversion_delay_ms'};
  for(const key of Object.keys(map) as (keyof NotebookInput)[]){if(key in patch)fields[map[key]]=key==='showTitleOnCover'||key==='autoConvertEnabled'?(patch[key]?1:0):patch[key]??null;}
  fields.updated_at=now();
  const keys=Object.keys(fields);await db.runAsync(`UPDATE notebooks SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`,...keys.map(k=>fields[k] as string|number|null),id);
  if(before.cover_image_path!==patch.coverImagePath&&patch.coverImagePath!==undefined&&before.cover_image_path){
   const used=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',before.cover_image_path);
   if(!used?.n)deleteCoverFile(before.cover_image_path);
  }
 },
 async remove(id:string){
  const db=await getDatabase();
  await db.runAsync('UPDATE notebooks SET deleted_at=? WHERE id=? AND deleted_at IS NULL',now(),id);
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
  const row=await db.getFirstAsync<{cover_image_path:string|null}>('SELECT cover_image_path FROM notebooks WHERE id=? AND deleted_at IS NOT NULL',id);
  if(!row)return;
  const pages=await db.getAllAsync<{thumbnail_path:string|null;content:string}>('SELECT thumbnail_path,content FROM pages WHERE notebook_id=?',id);
  await withSafeTransaction(db,async tx=>{
   await tx.runAsync('DELETE FROM pages WHERE notebook_id=?',id);
   await tx.runAsync('DELETE FROM notebooks WHERE id=? AND deleted_at IS NOT NULL',id);
  });
  const paths=new Set<string>();
  if(row.cover_image_path)paths.add(row.cover_image_path);
  for(const page of pages){
   if(page.thumbnail_path)paths.add(page.thumbnail_path);
   try{
    const content=JSON.parse(page.content) as {images?:{uri?:string}[]};
    for(const image of content.images??[]){
     if(typeof image.uri==='string'&&!image.uri.startsWith('data:')){
      const relative=coverPathFromUri(image.uri);
      if(relative)paths.add(relative);
     }
    }
   }catch(error){console.warn('Sayfa görsel yolları okunamadı',error)}
  }
  for(const path of paths){
   const usedCover=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM notebooks WHERE cover_image_path=?',path);
   const usedThumbnail=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM pages WHERE thumbnail_path=?',path);
   if(!usedCover?.n&&!usedThumbnail?.n)deleteCoverFile(path);
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
    await tx.runAsync('UPDATE notebooks SET auto_convert_enabled=?,conversion_font=?,conversion_delay_ms=? WHERE id=?',original.auto_convert_enabled,original.conversion_font,original.conversion_delay_ms,newId);
    const pages=await tx.getAllAsync<{position:number;template:string;paper_color:string;content:string;thumbnail_path:string|null}>('SELECT position,template,paper_color,content,thumbnail_path FROM pages WHERE notebook_id=? ORDER BY position',id);
    for(const page of pages)await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',Crypto.randomUUID(),newId,page.position,page.template,page.paper_color,page.content,null,date,date);
   });return newId;
  }catch(e){deleteCoverFile(newPath);throw e}
 },
 async moveToFolder(id:string,folderId:string|null){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET folder_id=? WHERE id=? AND deleted_at IS NULL',folderId,id)},
 async toggleFavorite(id:string){const db=await getDatabase();await db.runAsync('UPDATE notebooks SET favorite=CASE favorite WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=? AND deleted_at IS NULL',now(),id);}
};
