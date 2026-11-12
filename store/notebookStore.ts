import { Alert } from 'react-native';
import { create } from 'zustand';
import { defaultCoverColor } from '@/theme/covers';
import { folderRepository,type Folder } from '@/db/repositories/folderRepository';
import { notebookRepository,type NotebookRow,type NotebookInput } from '@/db/repositories/notebookRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
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
const toInput=(draft:NotebookDraft):NotebookInput=>({...draft,folderId:draft.folder==='Klasörsüz'?null:(useNotebookStore.getState().folders.find(f=>f.name===draft.folder)?.id??folderIds[draft.folder as NotebookFolder]??null),coverImagePath:coverPathFromUri(draft.coverImageUri),coverPresetId:null});
type State={
 lastDeletedId:string|null;clearUndo:()=>void;notebooks:Notebook[];deletedNotebooks:(Notebook & {deletedAt:string})[];folders:Folder[];selectedFolder:FolderFilter;sortBy:SortBy;viewMode:ViewMode;hydrated:boolean;
 hydrate:()=>Promise<void>;refresh:()=>Promise<void>;refreshDeleted:()=>Promise<void>;restoreNotebook:(id:string)=>Promise<void>;permanentlyDeleteNotebook:(id:string)=>Promise<void>;emptyTrash:()=>Promise<void>;refreshFolders:()=>Promise<void>;moveNotebook:(id:string,folderId:string|null)=>Promise<void>;
 setSelectedFolder:(folder:FolderFilter)=>Promise<void>;setSortBy:(sort:SortBy)=>Promise<void>;setViewMode:(mode:ViewMode)=>Promise<void>;
 addNotebook:(draft:NotebookDraft)=>Promise<string|null>;updateNotebook:(id:string,draft:NotebookDraft)=>Promise<boolean>;
 deleteNotebook:(id:string)=>Promise<void>;duplicateNotebook:(id:string)=>Promise<string|null>;toggleFavorite:(id:string)=>Promise<void>;
};
export const useNotebookStore=create<State>((set,get)=>({
 lastDeletedId:null,clearUndo:()=>set({lastDeletedId:null}),notebooks:[],deletedNotebooks:[],folders:[],selectedFolder:'Tümü',sortBy:'updated',viewMode:'grid',hydrated:false,
 hydrate:async()=>{const [folders,rows,sort,view,selected]=await Promise.all([folderRepository.getAll(),notebookRepository.getAll(),settingsRepository.get('sortBy'),settingsRepository.get('viewMode'),settingsRepository.get('selectedFolderId')]);
  set({folders,notebooks:rows.map(convert).map(n=>({...n,folder:(folders.find(f=>f.id===n.folderId)?.name??'Klasörsüz') as NotebookFolder})),sortBy:sort==='title'||sort==='created'?sort:'updated',viewMode:view==='list'?'list':'grid',selectedFolder:(folders.find(f=>f.id===selected)?.name??'Tümü') as FolderFilter,hydrated:true});void notebookRepository.purgeExpired().then(async()=>{await get().refresh();await get().refreshDeleted()}).catch(error=>console.error('30 günlük çöp temizliği başarısız',error));},
 refresh:async()=>{const rows=await notebookRepository.getAll();set({notebooks:rows.map(convert).map(n=>({...n,folder:(get().folders.find(f=>f.id===n.folderId)?.name??'Klasörsüz') as NotebookFolder}))})},
 refreshDeleted:async()=>{const rows=await notebookRepository.getDeleted();set({deletedNotebooks:rows.filter(r=>!!r.deleted_at).map(r=>({...convert(r),deletedAt:r.deleted_at!}))})},
 restoreNotebook:async id=>{await notebookRepository.restore(id);if(get().lastDeletedId===id)set({lastDeletedId:null});await Promise.all([get().refresh(),get().refreshDeleted()])},
 permanentlyDeleteNotebook:async id=>{await notebookRepository.permanentlyRemove(id);await get().refreshDeleted()},
 emptyTrash:async()=>{const rows=await notebookRepository.getDeleted();for(const row of rows)await notebookRepository.permanentlyRemove(row.id);await get().refreshDeleted()},
 refreshFolders:async()=>{const folders=await folderRepository.getAll();set({folders});await get().refresh();if(get().selectedFolder!=='Tümü'&&!folders.some(f=>f.name===get().selectedFolder)){set({selectedFolder:'Tümü'});await settingsRepository.set('selectedFolderId','')}},
 moveNotebook:async(id,folderId)=>{try{await notebookRepository.moveToFolder(id,folderId);await get().refresh()}catch(e){alert(e)}},
 setSelectedFolder:async folder=>{try{await settingsRepository.set('selectedFolderId',folder==='Tümü'?'':(get().folders.find(f=>f.name===folder)?.id??''));set({selectedFolder:folder})}catch(e){alert(e)}},
 setSortBy:async sort=>{try{await settingsRepository.set('sortBy',sort);set({sortBy:sort})}catch(e){alert(e)}},
 setViewMode:async mode=>{try{await settingsRepository.set('viewMode',mode);set({viewMode:mode})}catch(e){alert(e)}},
 addNotebook:async draft=>{try{const id=await notebookRepository.create(toInput(draft));await get().refresh();return id}catch(e){alert(e);return null}},
 updateNotebook:async(id,draft)=>{try{await notebookRepository.update(id,toInput(draft));await get().refresh();return true}catch(e){alert(e);return false}},
 deleteNotebook:async id=>{try{await notebookRepository.remove(id);await Promise.all([get().refresh(),get().refreshDeleted()]);set({lastDeletedId:id})}catch(e){alert(e)}},
 duplicateNotebook:async id=>{try{const key=await notebookRepository.duplicate(id);await get().refresh();return key}catch(e){alert(e);return null}},
 toggleFavorite:async id=>{try{await notebookRepository.toggleFavorite(id);await get().refresh()}catch(e){alert(e)}}
}));
export const defaultNotebookDraft:NotebookDraft={title:'Yeni defter',folder:'Kişisel',coverType:'color',coverColor:defaultCoverColor,coverImageUri:null,showTitleOnCover:true,template:'çizgili',paperColor:'beyaz',autoConvertEnabled:false,conversionFont:'Inter',conversionDelayMs:1000};
