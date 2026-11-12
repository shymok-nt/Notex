import {settingsRepository} from '@/db/repositories/settingsRepository';

const KEY='recentNotebookIds';
export async function getRecentNotebookIds():Promise<string[]>{
 try{
  const raw=await settingsRepository.get(KEY);
  const parsed:unknown=raw?JSON.parse(raw):[];
  return Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==='string').slice(0,30):[];
 }catch{return []}
}

export async function recordRecentNotebook(id:string):Promise<string[]>{
 const current=await getRecentNotebookIds();
 const next=[id,...current.filter(item=>item!==id)].slice(0,30);
 await settingsRepository.set(KEY,JSON.stringify(next));
 return next;
}
