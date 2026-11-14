/** Apply the change made against an older canvas render to the latest store data.
 * In particular, an erase must never resurrect strokes added/removed in
 * another JS commit before this callback finished.
 */
export function reconcileById<T extends {id:string}>(base:T[],incoming:T[],latest:T[]):T[]{
 const original=new Map(base.map(item=>[item.id,item]));
 const changed=new Map(incoming.filter(item=>original.has(item.id)&&original.get(item.id)!==item).map(item=>[item.id,item]));
 const retained=new Set(incoming.map(item=>item.id));
 const updated=latest.filter(item=>!original.has(item.id)||retained.has(item.id)).map(item=>changed.get(item.id)??item);
 const ids=new Set(updated.map(item=>item.id));
 for(const item of incoming){
  if(!original.has(item.id)&&!ids.has(item.id)){updated.push(item);ids.add(item.id)}
 }
 return updated;
}
