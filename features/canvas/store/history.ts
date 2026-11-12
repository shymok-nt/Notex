import type {PageContent} from '@/features/canvas/types';
type History={past:PageContent[];future:PageContent[]};
const stacks=new Map<string,History>();
const get=(id:string)=>{let h=stacks.get(id);if(!h){h={past:[],future:[]};stacks.set(id,h)}return h};
export function record(id:string,before:PageContent){const h=get(id);h.past.push(before);if(h.past.length>100)h.past.shift();h.future=[]}
export function undo(id:string,current:PageContent){const h=get(id),previous=h.past.pop();if(!previous)return null;h.future.push(current);return previous}
export function redo(id:string,current:PageContent){const h=get(id),next=h.future.pop();if(!next)return null;h.past.push(current);return next}
export function historyState(id:string){const h=get(id);return {canUndo:h.past.length>0,canRedo:h.future.length>0}}
export function clearHistory(){stacks.clear()}
