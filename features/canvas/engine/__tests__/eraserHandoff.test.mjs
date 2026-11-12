import test from 'node:test';
import assert from 'node:assert/strict';
import {hasCommittedErase,isCurrentEraseHandoff,shouldReleaseEraserHandoff} from '../eraserHandoff.ts';

test('eraser preview waits until the exact erased element list is rendered',()=>{
 const before=[{id:'stroke-a'},{id:'stroke-b'}];
 const erased=[{id:'stroke-b'}];
 assert.equal(hasCommittedErase(erased,before),false);
 assert.equal(shouldReleaseEraserHandoff(erased,before,4,4),false);
 assert.equal(shouldReleaseEraserHandoff(erased,erased,4,4),true);
});

test('a stale frame callback cannot release a newer eraser handoff',()=>{
 const erased=[{id:'stroke-b'}];
 assert.equal(isCurrentEraseHandoff(8,7),false);
 assert.equal(shouldReleaseEraserHandoff(erased,erased,8,7),false);
 assert.equal(shouldReleaseEraserHandoff(erased,erased,8,8),true);
});

test('a no-op or missing erase result never qualifies for commit',()=>{
 const current=[{id:'stroke-a'}];
 assert.equal(hasCommittedErase(null,current),false);
 assert.equal(shouldReleaseEraserHandoff(null,current,1,1),false);
});
