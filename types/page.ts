import type { PageTemplate,PaperColor } from '@/types/notebook';
export type Page={
 id:string;notebookId:string;position:number;template:PageTemplate;paperColor:PaperColor;
 content:string;thumbnailPath:string|null;createdAt:string;updatedAt:string;
};
