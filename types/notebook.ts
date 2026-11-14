export type NotebookFolder=string;
export type FolderFilter=string;
export type PageTemplate='boş'|'çizgili'|'kareli'|'noktalı';
export type PaperColor='beyaz'|'krem';
export type SortBy='updated'|'title'|'created';
export type ViewMode='grid'|'list';
export type Notebook={
 id:string;title:string;folderId:string|null;folder:NotebookFolder;
 coverType:'color'|'image'|'preset';coverColor:string;coverImagePath:string|null;coverImageUri:string|null;coverPresetId:string|null;
 showTitleOnCover:boolean;template:PageTemplate;paperColor:PaperColor;pageCount:number;
 createdAt:string;updatedAt:string;favorite:boolean;
};
export type NotebookDraft=Pick<Notebook,'title'|'folder'|'coverType'|'coverColor'|'coverImageUri'|'coverPresetId'|'showTitleOnCover'|'template'|'paperColor'>;
