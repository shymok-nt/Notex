import { Alert } from 'react-native';
import { create } from 'zustand';
import { defaultCoverColor } from '@/theme/covers';
import { folderRepository,type Folder } from '@/db/repositories/folderRepository';
import { notebookRepository,type NotebookRow,type NotebookInput } from '@/db/repositories/notebookRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { perfNow } from '@/features/canvas/engine/performance';
import { coverPathFromUri,resolveCoverUri,coverFileExists } from '@/utils/files';
import type { FolderFilter,Notebook,NotebookDraft,SortBy,ViewMode,NotebookFolder } from '@/types/notebook';
const folderIds:Record<NotebookFolder,string>={Ders:'ders',İş:'is',Kişisel:'kisisel'};
const folderNames:Record<string,NotebookFolder>={ders:'Ders',is:'İş',kisisel:'Kişisel'};
const alert=(e:unknown)=>Alert.alert('İşlem tamamlanamadı',e instanceof Error?e.message:'Lütfen tekrar dene.');
const convert=(r:NotebookRow):Notebook=>({
 id:r.id,title:r.title,folderId:r.folder_id,folder:folderNames[r.folder_id??'']??'Klasörsüz',
 coverType:r.cover_type,coverColor:r.cover_color??defaultCoverColor,coverImagePath:r.cover_image_path,
 coverImageUri:coverFileExists(r.cover_image_path)?resolveCoverUri(r.cover_image_path):null,
 coverPresetId:r.cover_preset_id,showTitleOnCover:!!r.show_title_on_cover,template:r.template,
 paperColor:r.paper_color,pageCount:r.page_count,createdAt:r.created_at,updatedAt:r.updated_at,favorite:!!r.favorite,
 autoConvertEnabled:r.auto_convert_enabled!==0,conversionFont:r.conversion_font==='SpaceGrotesk'?'SpaceGrotesk':'Inter',conversionDelayMs:Math.max(500,Math.min(2000,r.conversion_delay_ms||1000))
});
const activeNotebooks=(rows:NotebookRow[],folders:Folder[]):Notebook[]=>rows.map(convert).map(n=>({...n,folder:(folders.find(f=>f.id===n.folderId)?.name??'Klasörsüz') as NotebookFolder}));
const deletedNotebooks=(rows:NotebookRow[],folders:Folder[])=>rows.filter(r=>!!r.deleted_at).map(r=>({...convert(r),folder:(folders.find(f=>f.id===r.folder_id)?.name??'Klasörsüz') as NotebookFolder,deletedAt:r.deleted_at!}));
const toInput=(draft:NotebookDraft):NotebookInput=>({...draft,folderId:draft.folder==='Klasörsüz'?null:(useNotebookStore.getState().folders.find(f=>f.name===draft.folder)?.id??folderIds[draft.folder as NotebookFolder]??null),coverImagePath:coverPathFromUri(draft.coverImageUri)});
type State={
 lastDeletedId:string|null;lastDeletedIds:string[];clearUndo:()=>void;notebooks:Notebook[];deletedNotebooks:(Notebook & {deletedAt:string})[];folders:Folder[];selectedFolder:FolderFilter;sortBy:SortBy;viewMode:ViewMode;hydrated:boolean;
 hydrate:()=>Promise<void>;refresh:()=>Promise<void>;refreshDeleted:()=>Promise<void>;restoreNotebook:(id:string)=>Promise<void>;restoreNotebooks:(ids:string[])=>Promise<boolean>;permanentlyDeleteNotebook:(id:string)=>Promise<void>;emptyTrash:()=>Promise<void>;refreshFolders:()=>Promise<void>;moveNotebook:(id:string,folderId:string|null)=>Promise<void>;
 setSelectedFolder:(folder:FolderFilter)=>Promise<void>;setSortBy:(sort:SortBy)=>Promise<void>;setViewMode:(mode:ViewMode)=>Promise<void>;
 addNotebook:(draft:NotebookDraft)=>Promise<string|null>;updateNotebook:(id:string,draft:NotebookDraft)=>Promise<boolean>;
 deleteNotebook:(id:string)=>Promise<boolean>;deleteNotebooks:(ids:string[])=>Promise<string[]|null>;duplicateNotebook:(id:string)=>Promise<string|null>;toggleFavorite:(id:string)=>Promise<boolean>;
};
export const useNotebookStore=create<State>((set,get)=>({
 lastDeletedId:null,lastDeletedIds:[],clearUndo:()=>set({lastDeletedId:null,lastDeletedIds:[]}),notebooks:[],deletedNotebooks:[],folders:[],selectedFolder:'Tümü',sortBy:'updated',viewMode:'grid',hydrated:false,
 hydrate:async()=>{const [folders,rows,sort,view,selected]=await Promise.all([folderRepository.getAll(),notebookRepository.getAll(),settingsRepository.get('sortBy'),settingsRepository.get('viewMode'),settingsRepository.get('selectedFolderId')]);
  set({folders,notebooks:rows.map(convert).map(n=>({...n,folder:(folders.find(f=>f.id===n.folderId)?.name??'Klasörsüz') as NotebookFolder})),sortBy:sort==='title'||sort==='created'?sort:'updated',viewMode:view==='list'?'list':'grid',selectedFolder:(folders.find(f=>f.id===selected)?.name??'Tümü') as FolderFilter,hydrated:true});void notebookRepository.purgeExpired().then(async()=>{await get().refresh();await get().refreshDeleted()}).catch(error=>console.error('30 günlük çöp temizliği başarısız',error));},
 refresh:async()=>{const rows=await notebookRepository.getAll();set({notebooks:activeNotebooks(rows,get().folders)})},
 refreshDeleted:async()=>{const rows=await notebookRepository.getDeleted();set({deletedNotebooks:deletedNotebooks(rows,get().folders)})},
 restoreNotebook:async id=>{await notebookRepository.restore(id);const [active,deleted]=await Promise.all([notebookRepository.getAll(),notebookRepository.getDeleted()]);const remaining=get().lastDeletedIds.filter(value=>value!==id);set({notebooks:activeNotebooks(active,get().folders),deletedNotebooks:deletedNotebooks(deleted,get().folders),lastDeletedIds:remaining,lastDeletedId:remaining.length===1?remaining[0]:null})},
 restoreNotebooks:async ids=>{try{const restored=await notebookRepository.restoreMany(ids);const remaining=get().lastDeletedIds.filter(id=>!ids.includes(id));if(!restored.length){set({lastDeletedIds:remaining,lastDeletedId:remaining.length===1?remaining[0]:null});return true}const [active,deleted]=await Promise.all([notebookRepository.getAll(),notebookRepository.getDeleted()]);set({notebooks:activeNotebooks(active,get().folders),deletedNotebooks:deletedNotebooks(deleted,get().folders),lastDeletedIds:remaining,lastDeletedId:remaining.length===1?remaining[0]:null});return true}catch(e){alert(e);return false}},
 permanentlyDeleteNotebook:async id=>{await notebookRepository.permanentlyRemove(id);await get().refreshDeleted()},
 emptyTrash:async()=>{const rows=await notebookRepository.getDeleted();for(const row of rows)await notebookRepository.permanentlyRemove(row.id);await get().refreshDeleted()},
 refreshFolders:async()=>{const folders=await folderRepository.getAll();set({folders});await get().refresh();if(get().selectedFolder!=='Tümü'&&!folders.some(f=>f.name===get().selectedFolder)){set({selectedFolder:'Tümü'});await settingsRepository.set('selectedFolderId','')}},
 moveNotebook:async(id,folderId)=>{try{await notebookRepository.moveToFolder(id,folderId);await get().refresh()}catch(e){alert(e)}},
 setSelectedFolder:async folder=>{try{await settingsRepository.set('selectedFolderId',folder==='Tümü'?'':(get().folders.find(f=>f.name===folder)?.id??''));set({selectedFolder:folder})}catch(e){alert(e)}},
 setSortBy:async sort=>{try{await settingsRepository.set('sortBy',sort);set({sortBy:sort})}catch(e){alert(e)}},
 setViewMode:async mode=>{try{await settingsRepository.set('viewMode',mode);set({viewMode:mode})}catch(e){alert(e)}},
 addNotebook:async draft=>{try{const id=await notebookRepository.create(toInput(draft));await get().refresh();return id}catch(e){alert(e);return null}},
 updateNotebook:async(id,draft)=>{try{await notebookRepository.update(id,toInput(draft));await get().refresh();return true}catch(e){alert(e);return false}},
 deleteNotebook:async id=>{try{const removed=await notebookRepository.removeMany([id]);if(!removed.length)return false;const [active,deleted]=await Promise.all([notebookRepository.getAll(),notebookRepository.getDeleted()]);const undoIds=[...get().lastDeletedIds.filter(value=>value!==id),id];set({notebooks:activeNotebooks(active,get().folders),deletedNotebooks:deletedNotebooks(deleted,get().folders),lastDeletedIds:undoIds,lastDeletedId:undoIds.length===1?undoIds[0]:null});return true}catch(e){alert(e);return false}},
 deleteNotebooks:async ids=>{
  const started=__DEV__?perfNow():0;let removed:string[]=[],committed=false,unique:string[]=[];
  try{
   const prepStarted=__DEV__?perfNow():0;
   unique=[...new Set(ids.filter(id=>typeof id==='string'&&id.trim().length>0))];
   const prepEnded=__DEV__?perfNow():0,repositoryStarted=prepEnded;
   removed=await notebookRepository.removeMany(unique);committed=true;
   const repositoryEnded=__DEV__?perfNow():0;
   if(!removed.length)return [];
   const readsStarted=repositoryEnded;
   const [active,deleted]=await Promise.all([notebookRepository.getAll(),notebookRepository.getDeleted()]);
   const readsEnded=__DEV__?perfNow():0,undoIds=[...new Set([...get().lastDeletedIds,...removed])],stateStarted=readsEnded;
   set({notebooks:activeNotebooks(active,get().folders),deletedNotebooks:deletedNotebooks(deleted,get().folders),lastDeletedIds:undoIds,lastDeletedId:undoIds.length===1?undoIds[0]:null});
   if(__DEV__)console.log('[Notex perf] notebook_bulk_delete_store',{selected_id_prep_ms:Math.round((prepEnded-prepStarted)*10)/10,repository_ms:Math.round((repositoryEnded-repositoryStarted)*10)/10,list_refresh_ms:Math.round((readsEnded-readsStarted)*10)/10,state_update_ms:Math.round((perfNow()-stateStarted)*10)/10,total_ms:Math.round((perfNow()-started)*10)/10,requested_count:unique.length,moved_count:removed.length});
   return removed;
  }catch(e){
   if(committed&&removed.length){
    const current=get(),moved=new Set(removed),deletedAt=new Date().toISOString(),undoIds=[...new Set([...current.lastDeletedIds,...removed])];
    const newlyDeleted=current.notebooks.filter(notebook=>moved.has(notebook.id)).map(notebook=>({...notebook,deletedAt}));
    set({notebooks:current.notebooks.filter(notebook=>!moved.has(notebook.id)),deletedNotebooks:[...current.deletedNotebooks.filter(notebook=>!moved.has(notebook.id)),...newlyDeleted],lastDeletedIds:undoIds,lastDeletedId:undoIds.length===1?undoIds[0]:null});
    Alert.alert('Defterler taşındı','Liste yenilenirken sorun oluştu. Defterler Silinenler bölümünde korunuyor.');
    if(__DEV__)console.warn('[Notex perf] notebook_bulk_delete_refresh_failed',{moved_count:removed.length,error:e});
    return removed;
   }
   alert(e);return null;
  }
 },
 duplicateNotebook:async id=>{try{const key=await notebookRepository.duplicate(id);await get().refresh();return key}catch(e){alert(e);return null}},
 toggleFavorite:async id=>{try{await notebookRepository.toggleFavorite(id);await get().refresh();return true}catch(e){alert(e);return false}}
}));
export const defaultNotebookDraft:NotebookDraft={title:'Yeni defter',folder:'Kişisel',coverType:'color',coverColor:defaultCoverColor,coverImageUri:null,coverPresetId:null,showTitleOnCover:true,template:'çizgili',paperColor:'beyaz',autoConvertEnabled:false,conversionFont:'Inter',conversionDelayMs:1000};
