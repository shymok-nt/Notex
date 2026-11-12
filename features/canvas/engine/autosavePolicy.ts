export const AUTOSAVE_IDLE_DELAY_MS=2500;
export const AUTOSAVE_MAX_DIRTY_AGE_MS=15000;
export const AUTOSAVE_RETRY_DELAY_MS=5000;

export function autosaveDelay(firstDirtyAt:number,now:number):number{
 const elapsed=firstDirtyAt?now-firstDirtyAt:0;
 return Math.max(0,Math.min(AUTOSAVE_IDLE_DELAY_MS,AUTOSAVE_MAX_DIRTY_AGE_MS-elapsed));
}

export function canResetDirtyWindow(currentVersion:number,snapshotVersion:number,dirty:boolean):boolean{
 return currentVersion===snapshotVersion&&!dirty;
}

export function visibleSaveStatus(error:boolean,saving:boolean):'error'|'saving'|null{
 if(error)return 'error';
 return saving?'saving':null;
}
