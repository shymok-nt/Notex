import {settingsRepository} from '@/db/repositories/settingsRepository';

const key=(notebookId:string)=>`lastNotebookPage:${notebookId}`;
let writes:Promise<void>=Promise.resolve();

export async function readLastNotebookPage(notebookId:string):Promise<string|null>{
 return settingsRepository.get(key(notebookId));
}

export function rememberNotebookPage(notebookId:string,pageId:string):Promise<void>{
 const write=writes.then(()=>settingsRepository.set(key(notebookId),pageId));
 writes=write.catch(()=>{});
 return write;
}
