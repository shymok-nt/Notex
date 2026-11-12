export type NotebookFolder=string;
export type FolderFilter=string;
export type PageTemplate='boş'|'çizgili'|'kareli'|'noktalı';
export type PaperColor='beyaz'|'krem';
export type SortBy='updated'|'title'|'created';
export type ViewMode='grid'|'list';
export type ConversionFont='Inter'|'SpaceGrotesk';
export type Notebook={
 id:string;title:string;folderId:string|null;folder:NotebookFolder;
 coverType:'color'|'image'|'preset';coverColor:string;coverImagePath:string|null;coverImageUri:string|null;coverPresetId:string|null;
 showTitleOnCover:boolean;template:PageTemplate;paperColor:PaperColor;pageCount:number;
 createdAt:string;updatedAt:string;favorite:boolean;autoConvertEnabled:boolean;conversionFont:ConversionFont;conversionDelayMs:number;
};
export type NotebookDraft=Pick<Notebook,'title'|'folder'|'coverType'|'coverColor'|'coverImageUri'|'showTitleOnCover'|'template'|'paperColor'|'autoConvertEnabled'|'conversionFont'|'conversionDelayMs'>;
