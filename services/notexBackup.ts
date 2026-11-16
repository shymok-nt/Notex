import JSZip from 'jszip';
import * as Crypto from 'expo-crypto';
import { File,Directory,Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { getDatabase,withSafeTransaction } from '@/db/database';
import { coverPathFromUri } from '@/utils/files';
import {deleteStoredFile,isTauriDesktop,readStoredFile,restoreBackupAsset} from '@/utils/tauriFiles';

type Folder={id:string;name:string;position:number;created_at:string};
type Notebook={id:string;title:string;folder_id:string|null;cover_type:string;cover_color:string|null;cover_image_path:string|null;cover_preset_id:string|null;show_title_on_cover:number;template:string;paper_color:string;favorite:number;created_at:string;updated_at:string;deleted_at:string|null};
type Page={id:string;notebook_id:string;position:number;template:string;paper_color:string;content:string;thumbnail_path:string|null;created_at:string;updated_at:string};
type Setting={key:string;value:string};
type DeckRow={id:string;name:string;color:string;created_at:string};
type CardRow={id:string;deck_id:string;front:string;back:string;source_note_id:string|null;created_at:string;ease:number;interval:number;repetitions:number;due_date:string;last_reviewed:string|null};
type ReviewRow={id:string;card_id:string;rating:string;reviewed_at:string};
type BackupData={folders:Folder[];notebooks:Notebook[];pages:Page[];settings:Setting[];decks?:DeckRow[];cards?:CardRow[];cardReviews?:ReviewRow[]};
type Manifest={format:number;appVersion:string;exportedAt:string;counts:{folders:number;notebooks:number;pages:number;files:number;decks?:number;cards?:number;cardReviews?:number}};
const yieldUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const safePath=(value:string)=>!value.startsWith('/')&&!value.includes('..')&&!value.includes('\\')&&/^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(value);
const decodeBase64=(base64:string)=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
const encodeBase64=(bytes:Uint8Array)=>{let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result)};
const imageExtension=(mime:string)=>mime==='image/png'?'png':mime==='image/webp'?'webp':mime==='image/gif'?'gif':'jpg';
export type Progress=(label:string,percent:number)=>void;
export async function createBackup(progress:Progress){
 const db=await getDatabase();progress('Defterler hazırlanıyor…',5);
 const folders=await db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY position');
 const notebooks=await db.getAllAsync<Notebook>('SELECT * FROM notebooks WHERE deleted_at IS NULL ORDER BY created_at');
 const pages=await db.getAllAsync<Page>('SELECT p.* FROM pages p JOIN notebooks n ON n.id=p.notebook_id WHERE n.deleted_at IS NULL ORDER BY p.notebook_id,p.position');
 const settings=await db.getAllAsync<Setting>('SELECT * FROM settings');
 const decks=await db.getAllAsync<DeckRow>('SELECT * FROM card_decks ORDER BY created_at');
 const cards=await db.getAllAsync<CardRow>('SELECT * FROM cards ORDER BY created_at');
 const cardReviews=await db.getAllAsync<ReviewRow>('SELECT * FROM card_reviews ORDER BY reviewed_at');
 const zip=new JSZip();const filePaths=new Set<string>();
 const transformed:BackupData={folders,notebooks:notebooks.map(n=>({...n})),pages:pages.map(p=>({...p})),settings,decks,cards,cardReviews};
 for(const n of transformed.notebooks)if(n.cover_image_path){if(!safePath(n.cover_image_path))throw new Error('Geçersiz kapak yolu');filePaths.add(n.cover_image_path)}
 for(const p of transformed.pages)if(p.thumbnail_path){if(!safePath(p.thumbnail_path))throw new Error('Geçersiz sayfa dosyası yolu');filePaths.add(p.thumbnail_path)}
 let imageCount=0;
 for(let i=0;i<transformed.pages.length;i++){
  const p=transformed.pages[i];let parsed:unknown;
  try{parsed=JSON.parse(p.content)}catch{throw new Error('Sayfa içeriği okunamadı')}
   if(parsed&&typeof parsed==='object'){
    const data=parsed as {images?:{uri?:string}[];backgroundImage?:{uri?:string};pdfSource?:{file?:string}};
    if(typeof data.pdfSource?.file==='string'){if(!safePath(data.pdfSource.file))throw new Error('Geçersiz PDF kaynak yolu');filePaths.add(data.pdfSource.file)}
    const images=[...(Array.isArray(data.images)?data.images:[]),...(data.backgroundImage?[data.backgroundImage]:[])];
    for(const img of images){
    if(typeof img.uri!=='string')continue;
    const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(img.uri);
    if(match){const path='images/'+Crypto.randomUUID()+'.'+imageExtension(match[1]);zip.file('files/'+path,decodeBase64(match[2]));img.uri=path;imageCount++}
    else if(isTauriDesktop()&&safePath(img.uri)){filePaths.add(img.uri)}
    else if(img.uri.startsWith('file:')||img.uri.startsWith('content:')){
     const path=coverPathFromUri(img.uri);if(!path||!safePath(path))throw new Error('Sayfa görseli okunamadı');filePaths.add(path);img.uri=path;
    }else if(!safePath(img.uri))throw new Error('Desteklenmeyen görsel yolu');
   }
   p.content=JSON.stringify(data);
  }
  if(i%5===0){progress('Sayfalar hazırlanıyor…',10+Math.round(35*i/Math.max(1,pages.length)));await yieldUI()}
 }
 let done=0;for(const path of filePaths){
  if(isTauriDesktop())zip.file('files/'+path,await readStoredFile(path));
  else{const file=new File(Paths.document,path);if(!file.exists)throw new Error('Yedeklenecek dosya bulunamadı: '+path);zip.file('files/'+path,await file.bytes())}
  done++;progress('Resimler hazırlanıyor…',45+Math.round(30*done/Math.max(1,filePaths.size)));await yieldUI();
 }
 const manifest:Manifest={format:2,appVersion:'1.0.0',exportedAt:new Date().toISOString(),counts:{folders:folders.length,notebooks:notebooks.length,pages:pages.length,files:filePaths.size+imageCount,decks:decks.length,cards:cards.length,cardReviews:cardReviews.length}};
 zip.file('manifest.json',JSON.stringify(manifest));zip.file('data.json',JSON.stringify(transformed));
 progress('Yedek sıkıştırılıyor…',80);await yieldUI();
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:3}},(m:{percent:number})=>progress('Yedek sıkıştırılıyor…',80+Math.round(m.percent*.19)));
 progress('Yedek hazır',100);return bytes;
}
export async function inspectBackup(bytes:Uint8Array){
 try{
  const zip=await JSZip.loadAsync(bytes);
  const raw=await zip.file('manifest.json')?.async('string');
  if(!raw)throw Error('missing manifest');
  const manifest=JSON.parse(raw) as Manifest;
  if(manifest.format!==1&&manifest.format!==2)throw new Error('Bilinmeyen yedek biçimi');
  if(!manifest.counts||!Number.isSafeInteger(manifest.counts.notebooks)||!Number.isSafeInteger(manifest.counts.pages)||!Number.isSafeInteger(manifest.counts.files))throw Error('invalid counts');
  if(!zip.file('data.json'))throw Error('missing data');
  return {manifest,zip};
 }catch(e){if(e instanceof Error&&e.message==='Bilinmeyen yedek biçimi')throw e;throw new Error('Bu dosya okunamadı')}
}
export async function importBackup(bytes:Uint8Array,progress:Progress){
 const {zip}=await inspectBackup(bytes);
 const created:string[]=[];
 try{
  const raw=await zip.file('data.json')!.async('string');
  const data=JSON.parse(raw) as BackupData;
  if(!Array.isArray(data.folders)||!Array.isArray(data.notebooks)||!Array.isArray(data.pages)||!Array.isArray(data.settings))throw Error('invalid data');
  const decks=data.decks??[],cards=data.cards??[],cardReviews=data.cardReviews??[];
  if(!Array.isArray(decks)||!Array.isArray(cards)||!Array.isArray(cardReviews))throw Error('invalid card data');
  const db=await getDatabase();
  const folderMap=new Map<string,string>(),notebookMap=new Map<string,string>();
  const deckMap=new Map(decks.map(d=>[d.id,Crypto.randomUUID()]));
  const cardMap=new Map(cards.map(c=>[c.id,Crypto.randomUUID()]));
  const existingFolders=await db.getAllAsync<{id:string;name:string}>('SELECT id,name FROM folders');
  const folderIds=new Set(existingFolders.map(f=>f.id));
  const folderNames=new Map(existingFolders.map(f=>[f.name.trim().toLocaleLowerCase('tr-TR'),f.id]));
  const newFolders:Folder[]=[];
  for(const f of data.folders){
   const name=f.name.trim();if(!name)throw Error('invalid folder name');
   const normalized=name.toLocaleLowerCase('tr-TR');
   const existing=folderNames.get(normalized);
   if(existing){folderMap.set(f.id,existing);continue}
   const id=folderIds.has(f.id)?Crypto.randomUUID():f.id;
   folderMap.set(f.id,id);folderIds.add(id);folderNames.set(normalized,id);newFolders.push({...f,id,name});
  }
  for(const n of data.notebooks)notebookMap.set(n.id,Crypto.randomUUID());
  const fileMap=new Map<string,string>();
  const paths=new Set<string>();
  for(const n of data.notebooks)if(n.cover_image_path)paths.add(n.cover_image_path);
  for(const p of data.pages){
   if(p.thumbnail_path)paths.add(p.thumbnail_path);
    const parsed=JSON.parse(p.content) as {images?:{uri?:string}[];backgroundImage?:{uri?:string};pdfSource?:{file?:string}};
    if(typeof parsed.pdfSource?.file==='string')paths.add(parsed.pdfSource.file);
    for(const img of [...(parsed.images??[]),...(parsed.backgroundImage?[parsed.backgroundImage]:[])])if(typeof img.uri==='string'&&!img.uri.startsWith('data:'))paths.add(img.uri);
  }
  // On web, expo-file-system's Directory.create may call an unavailable validatePath native method.
  // Do not enter a database transaction or create partial records until file storage is supported.
  if(Platform.OS==='web'&&!isTauriDesktop()&&paths.size>0)throw new Error('Web üzerinde görsel dosyalarını güvenli biçimde geri yükleme henüz desteklenmiyor. Veriler değiştirilmedi.');
  if(paths.size>0&&!isTauriDesktop()){const dir=new Directory(Paths.document,'covers');dir.create({idempotent:true,intermediates:true});}
  let i=0;for(const path of paths){
   if(!safePath(path))throw Error('invalid path');
   const entry=zip.file('files/'+path);if(!entry)throw Error('missing image');
   const ext=path.split('.').pop()!.toLowerCase();if(!['jpg','jpeg','png','webp','heic','gif','pdf'].includes(ext))throw Error('invalid image');
   const blob=await entry.async('uint8array');
   let relative:string;
   if(isTauriDesktop())relative=await restoreBackupAsset(path,blob);
   else{relative='covers/'+Crypto.randomUUID()+'.'+ext;const target=new File(Paths.document,relative);await target.write(blob)}
   created.push(relative);fileMap.set(path,relative);
   i++;progress('Resimler geri yükleniyor…',Math.round(50*i/Math.max(1,paths.size)));await yieldUI();
  }
  await withSafeTransaction(db,async tx=>{
   for(const f of newFolders){
    await tx.runAsync('INSERT INTO folders(id,name,position,created_at) VALUES(?,?,?,?)',f.id,f.name,f.position,f.created_at);
   }
   for(const n of data.notebooks){
    const notebookId=notebookMap.get(n.id)!;
    await tx.runAsync('INSERT INTO notebooks(id,title,folder_id,cover_type,cover_color,cover_image_path,cover_preset_id,show_title_on_cover,template,paper_color,favorite,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)',notebookId,n.title,n.folder_id?folderMap.get(n.folder_id)??null:null,n.cover_type,n.cover_color,n.cover_image_path?fileMap.get(n.cover_image_path)??null:null,n.cover_preset_id,n.show_title_on_cover,n.template,n.paper_color,n.favorite,n.created_at,n.updated_at);
   }
   for(const p of data.pages){
     const parsed=JSON.parse(p.content) as {images?:{uri?:string}[];backgroundImage?:{uri?:string};pdfSource?:{file?:string}};
     if(typeof parsed.pdfSource?.file==='string'){
      const restoredSource=fileMap.get(parsed.pdfSource.file);
      if(!restoredSource)throw new Error('PDF kaynak dosyası yedekten geri yüklenemedi: '+parsed.pdfSource.file);
      parsed.pdfSource.file=restoredSource;
     }
     for(const img of [...(parsed.images??[]),...(parsed.backgroundImage?[parsed.backgroundImage]:[])])if(typeof img.uri==='string'&&fileMap.has(img.uri)){
     const path=fileMap.get(img.uri)!;
     if(isTauriDesktop())img.uri=path;
     else{const file=new File(Paths.document,path);const ext=path.split('.').pop();const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':ext==='gif'?'image/gif':'image/jpeg';img.uri='data:'+mime+';base64,'+encodeBase64(await file.bytes())}
    }
    await tx.runAsync('INSERT INTO pages(id,notebook_id,position,template,paper_color,content,thumbnail_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',Crypto.randomUUID(),notebookMap.get(p.notebook_id)!,p.position,p.template,p.paper_color,JSON.stringify(parsed),p.thumbnail_path?fileMap.get(p.thumbnail_path)??null:null,p.created_at,p.updated_at);
   }
   for(const d of decks)await tx.runAsync('INSERT INTO card_decks(id,name,color,created_at) VALUES(?,?,?,?)',deckMap.get(d.id)!,d.name,d.color,d.created_at);
   for(const c of cards){const deckId=deckMap.get(c.deck_id);if(!deckId)throw Error('card deck missing');await tx.runAsync('INSERT INTO cards(id,deck_id,front,back,source_note_id,created_at,ease,interval,repetitions,due_date,last_reviewed) VALUES(?,?,?,?,?,?,?,?,?,?,?)',cardMap.get(c.id)!,deckId,c.front,c.back,c.source_note_id===null?null:c.source_note_id===''?'':notebookMap.get(c.source_note_id)??null,c.created_at,c.ease,c.interval,c.repetitions,c.due_date,c.last_reviewed)}
   for(const r of cardReviews){const cardId=cardMap.get(r.card_id);if(!cardId)throw Error('review card missing');await tx.runAsync('INSERT INTO card_reviews(id,card_id,rating,reviewed_at) VALUES(?,?,?,?)',Crypto.randomUUID(),cardId,r.rating,r.reviewed_at)}
   for(const setting of data.settings.filter(s=>s.key==='cardsNewDailyLimit'||s.key==='cardsEnabled'))await tx.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',setting.key,setting.value);
  });
  progress('Geri yükleme tamamlandı',100);
 }catch(error){
  for(const path of created){try{if(isTauriDesktop())await deleteStoredFile(path);else{const f=new File(Paths.document,path);if(f.exists)f.delete()}}catch(e){console.warn('Geri alma dosya temizliği başarısız',e)}}
  if(error instanceof Error&&error.message.startsWith('Web üzerinde'))throw error;
  throw new Error('Bu dosya okunamadı veya geri yüklenemedi: '+String(error));
 }
}
export function webDownload(bytes:Uint8Array,name:string){
 if(Platform.OS!=='web')return;
 const blob=new Blob([new Uint8Array(bytes).buffer],{type:'application/octet-stream'});
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
