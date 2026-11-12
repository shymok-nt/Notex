import test from 'node:test';
import assert from 'node:assert/strict';
import {interruptedStrokeAction,isCurrentStrokeCommit} from '../strokeInterruption.ts';

test('an active pen stroke is committed when another gesture interrupts it',()=>{
 assert.equal(interruptedStrokeAction('pen',true,false,false,4),'commit');
 assert.equal(interruptedStrokeAction('highlighter',true,false,false,2),'commit');
});

test('pending commits are preserved and never scheduled twice',()=>{
 assert.equal(interruptedStrokeAction('pen',false,true,false,4),'preserve');
 assert.equal(interruptedStrokeAction('pen',true,true,false,4),'commit');
});

test('inactive, blocked, non-ink and empty gestures are discarded',()=>{
 assert.equal(interruptedStrokeAction('pen',false,false,false,4),'discard');
 assert.equal(interruptedStrokeAction('pen',true,false,true,4),'discard');
 assert.equal(interruptedStrokeAction('eraser',true,false,false,4),'discard');
 assert.equal(interruptedStrokeAction('pen',true,false,false,0),'discard');
});

test('late completion cannot replace the overlay owned by a newer stroke',()=>{
 assert.equal(isCurrentStrokeCommit(8,8),true);
 assert.equal(isCurrentStrokeCommit(9,8),false);
});
