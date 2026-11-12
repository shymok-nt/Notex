import { create } from 'zustand';
import type { FolderFilter, NewNote, Note } from '@/types/note';

type NotesState = { notes:Note[]; selectedFolder:FolderFilter; setSelectedFolder:(folder:FolderFilter)=>void; addNote:(input:NewNote)=>string; renameNote:(id:string,title:string)=>void; deleteNote:(id:string)=>void; toggleFavorite:(id:string)=>void };
export const useNotesStore = create<NotesState>((set)=>({
 notes:[], selectedFolder:'Tümü', setSelectedFolder:(selectedFolder)=>set({selectedFolder}),
 addNote:(input)=>{ const id=`${Date.now()}-${Math.random().toString(36).slice(2,9)}`; set(s=>({notes:[{...input,id,pageCount:1,updatedAt:new Date().toISOString(),favorite:false},...s.notes]})); return id; },
 renameNote:(id,title)=>set(s=>({notes:s.notes.map(n=>n.id===id?{...n,title,updatedAt:new Date().toISOString()}:n)})),
 deleteNote:(id)=>set(s=>({notes:s.notes.filter(n=>n.id!==id)})),
 toggleFavorite:(id)=>set(s=>({notes:s.notes.map(n=>n.id===id?{...n,favorite:!n.favorite}:n)})),
}));
