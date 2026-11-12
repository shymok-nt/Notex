export type NoteFolder = 'Ders' | 'İş' | 'Kişisel';
export type NoteTemplate = 'çizgili' | 'kareli' | 'noktalı' | 'boş';
export type FolderFilter = 'Tümü' | NoteFolder;
export type Note = { id:string; title:string; folder:NoteFolder; template:NoteTemplate; pageCount:number; updatedAt:string; favorite:boolean };
export type NewNote = Pick<Note,'title'|'folder'|'template'>;
