import type { Notebook, SortBy } from '@/types/notebook';
const weekdays=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
const months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
export function dateLabel(iso:string){const d=new Date(iso),today=new Date();const date0=new Date(today.getFullYear(),today.getMonth(),today.getDate());const date1=new Date(d.getFullYear(),d.getMonth(),d.getDate());const diff=Math.round((date0.getTime()-date1.getTime())/86400000);if(diff===0)return 'Bugün';if(diff===1)return 'Dün';if(diff>=2&&diff<7)return weekdays[d.getDay()];return `${d.getDate()} ${months[d.getMonth()]}`;}
export function sortNotebooks(notes:Notebook[],sortBy:SortBy){return [...notes].sort((a,b)=>sortBy==='title'?a.title.localeCompare(b.title,'tr'):sortBy==='created'?b.createdAt.localeCompare(a.createdAt):b.updatedAt.localeCompare(a.updatedAt));}
