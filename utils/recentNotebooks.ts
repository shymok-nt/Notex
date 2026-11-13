import {settingsRepository} from '@/db/repositories/settingsRepository';
import {moveNotebookToRecentFront,parseRecentNotebookActivity,type RecentNotebookActivity} from '@/utils/recentNotebookActivity';

const KEY='recentNotebookActivity';
const LEGACY_KEY='recentNotebookIds';
let mutationQueue:Promise<void>=Promise.resolve();
export async function getRecentNotebookActivity():Promise<RecentNotebookActivity[]>{
 try{
  const [raw,legacy]=await Promise.all([settingsRepository.get(KEY),settingsRepository.get(LEGACY_KEY)]);
  return parseRecentNotebookActivity(raw,legacy);
 }catch{return []}
}
export async function getRecentNotebookIds():Promise<string[]>{
 return (await getRecentNotebookActivity()).map(entry=>entry.id);
}

export function recordRecentNotebook(id:string):Promise<string[]>{
 const operation=mutationQueue.then(async()=>{
  const current=await getRecentNotebookActivity();
  const next=moveNotebookToRecentFront(current,id,new Date().toISOString());
  await settingsRepository.set(KEY,JSON.stringify(next));
  return next.map(entry=>entry.id);
 });
 mutationQueue=operation.then(()=>undefined,()=>undefined);
 return operation;
}
