import test from 'node:test';
import assert from 'node:assert/strict';
import {autosaveDelay,AUTOSAVE_IDLE_DELAY_MS,AUTOSAVE_MAX_DIRTY_AGE_MS,AUTOSAVE_RETRY_DELAY_MS,canResetDirtyWindow,visibleSaveStatus} from '../autosavePolicy.ts';

test('a successful clean save resets the max-dirty-age timer for the next stroke',()=>{
 assert.equal(canResetDirtyWindow(4,4,false),true);
 const nextDirtyAt=20_000;
 assert.equal(autosaveDelay(nextDirtyAt,nextDirtyAt),AUTOSAVE_IDLE_DELAY_MS);
});

test('max dirty age bounds continuous edits without forcing all later saves immediately',()=>{
 const firstDirtyAt=1_000;
 assert.equal(autosaveDelay(firstDirtyAt,firstDirtyAt+10_000),AUTOSAVE_IDLE_DELAY_MS);
 assert.equal(autosaveDelay(firstDirtyAt,firstDirtyAt+AUTOSAVE_MAX_DIRTY_AGE_MS-500),500);
 assert.equal(autosaveDelay(firstDirtyAt,firstDirtyAt+AUTOSAVE_MAX_DIRTY_AGE_MS),0);
});

test('a save finishing with newer dirty content must not reset that content window',()=>{
 assert.equal(canResetDirtyWindow(8,7,true),false);
 assert.equal(canResetDirtyWindow(8,8,true),false);
});

test('failed saves retain a bounded retry delay',()=>{
 assert.equal(AUTOSAVE_RETRY_DELAY_MS,5_000);
});

test('successful background saves show no status; genuine pending or failed saves remain visible',()=>{
 assert.equal(visibleSaveStatus(false,false),null);
 assert.equal(visibleSaveStatus(false,true),'saving');
 assert.equal(visibleSaveStatus(true,true),'error');
});
