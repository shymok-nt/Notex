import assert from 'node:assert/strict';
import test from 'node:test';
import {moveNotebookToRecentFront,parseRecentNotebookActivity} from '../recentNotebookActivity.ts';

test('legacy recent notebook IDs remain readable without invented timestamps',()=>{
 assert.deepEqual(parseRecentNotebookActivity(null,JSON.stringify(['a','b','a',''])),[
  {id:'a',openedAt:null},
  {id:'b',openedAt:null},
 ]);
});

test('stored activity drops malformed entries and duplicate IDs',()=>{
 assert.deepEqual(parseRecentNotebookActivity(JSON.stringify([
  {id:'a',openedAt:'2026-11-13T10:00:00.000Z'},
  {id:'a',openedAt:'2026-11-13T10:01:00.000Z'},
  {id:'b',openedAt:'not-a-date'},
  {id:'',openedAt:null},
  null,
 ])),[
  {id:'a',openedAt:'2026-11-13T10:00:00.000Z'},
  {id:'b',openedAt:null},
 ]);
});

test('opening a notebook moves it to the front and refreshes its time once',()=>{
 const result=moveNotebookToRecentFront([
  {id:'a',openedAt:'2026-11-12T10:00:00.000Z'},
  {id:'b',openedAt:'2026-11-12T09:00:00.000Z'},
 ],'b','2026-11-13T10:00:00.000Z');
 assert.deepEqual(result,[
  {id:'b',openedAt:'2026-11-13T10:00:00.000Z'},
  {id:'a',openedAt:'2026-11-12T10:00:00.000Z'},
 ]);
});

test('recent list is capped at thirty notebooks',()=>{
 const entries=Array.from({length:35},(_,index)=>({id:`n${index}`,openedAt:null}));
 assert.equal(moveNotebookToRecentFront(entries,'new','2026-11-13T10:00:00.000Z').length,30);
 assert.equal(parseRecentNotebookActivity(JSON.stringify(entries)).length,30);
});
