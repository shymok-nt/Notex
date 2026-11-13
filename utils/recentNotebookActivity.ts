export type RecentNotebookActivity={id:string;openedAt:string|null};

export function parseRecentNotebookActivity(value:string|null,legacyValue:string|null=null):RecentNotebookActivity[]{
 let parsed:unknown;
 try{parsed=value?JSON.parse(value):null}catch{parsed=null}
 if(!Array.isArray(parsed)){
  try{parsed=legacyValue?JSON.parse(legacyValue):[]}catch{parsed=[]}
 }
 const entries:unknown[]=Array.isArray(parsed)?parsed:[];
 const result:RecentNotebookActivity[]=[],seen=new Set<string>();
 for(const item of entries){
  const id=typeof item==='string'?item:item&&typeof item==='object'&&'id'in item?(item as {id?:unknown}).id:null;
  if(typeof id!=='string'||!id.trim()||seen.has(id))continue;
  const rawOpenedAt=item&&typeof item==='object'&&'openedAt'in item?(item as {openedAt?:unknown}).openedAt:null;
  const openedAt=typeof rawOpenedAt==='string'&&Number.isFinite(Date.parse(rawOpenedAt))?rawOpenedAt:null;
  seen.add(id);result.push({id,openedAt});
  if(result.length===30)break;
 }
 return result;
}

export function moveNotebookToRecentFront(entries:RecentNotebookActivity[],id:string,openedAt:string):RecentNotebookActivity[]{
 if(!id.trim())return entries.slice(0,30);
 return [{id,openedAt},...entries.filter(item=>item.id!==id)].slice(0,30);
}
