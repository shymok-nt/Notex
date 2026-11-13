import type {Element} from '@/features/canvas/types';

let clipboard:Element[]=[];

const cloneElements=(elements:readonly Element[]):Element[]=>JSON.parse(JSON.stringify(elements)) as Element[];

/** In-memory, app-local clipboard. It intentionally does not persist to SQLite. */
export function writeSelectionClipboard(elements:readonly Element[]):void{clipboard=cloneElements(elements)}
export function readSelectionClipboard():Element[]{return cloneElements(clipboard)}
export function hasSelectionClipboard():boolean{return clipboard.length>0}

