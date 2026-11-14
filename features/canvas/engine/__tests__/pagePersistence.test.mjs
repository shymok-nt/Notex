import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(source,dependencies={}){
 const code=ts.transpileModule(readFileSync(resolve(process.cwd(),source),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const mod={exports:{}};
 vm.runInNewContext(code,{
  module:mod,exports:mod.exports,
  require:(name)=>{
   if(name in dependencies)return dependencies[name];
   throw new Error('Unexpected import '+name);
  },
  Map,Set,Error,Promise,console,setTimeout,clearTimeout
 },{filename:source});
 return mod.exports;
}

test('fully erased page stays empty, including an empty string snapshot',async()=>{
 const stored=new Map([['page-a','{"v":2,"elements":[{"id":"ink"}]}']]);
 const repo={
  updateContent:async(id,content)=>{stored.set(id,content)},
  getStoredContent:async id=>stored.get(id)??null
 };
 const s=load('features/canvas/store/pagePersistence.ts',{'@/db/repositories/pageRepository':{pageRepository:repo}});
 s.enqueuePageSave('page-a','{"v":2,"elements":[]}');
 await s.flushPageSave('page-a');
 assert.equal(stored.get('page-a'),'{"v":2,"elements":[]}');
 s.enqueuePageSave('page-a','');
 await s.flushPageSave('page-a');
 assert.equal(stored.get('page-a'),'');
 assert.equal(s.getPageSaveStatus('page-a'),'saved');
});

test('page changes are debounced by 500ms and the last edit wins',async()=>{
 const stored=new Map();
 const writes=[];
 const repo={
  updateContent:async(id,content)=>{writes.push(content);stored.set(id,content)},
  getStoredContent:async id=>stored.get(id)??null
 };
 const s=load('features/canvas/store/pagePersistence.ts',{'@/db/repositories/pageRepository':{pageRepository:repo}});
 s.enqueuePageSave('page-b','first');
 s.enqueuePageSave('page-b','second');
 assert.equal(writes.length,0);
 await new Promise(resolve=>setTimeout(resolve,560));
 assert.deepEqual(writes,['second']);
});

test('flush saves edits queued during an earlier SQLite write',async()=>{
 const stored=new Map();
 let release;
 const blocker=new Promise(resolve=>{release=resolve});
 const writes=[];
 const repo={
  updateContent:async(id,content)=>{writes.push(content);if(content==='first')await blocker;stored.set(id,content)},
  getStoredContent:async id=>stored.get(id)??null
 };
 const s=load('features/canvas/store/pagePersistence.ts',{'@/db/repositories/pageRepository':{pageRepository:repo}});
 s.enqueuePageSave('page-c','first');
 const flushing=s.flushPageSave('page-c');
 await Promise.resolve();await Promise.resolve();
 s.enqueuePageSave('page-c','second');
 release();
 await flushing;
 assert.deepEqual(writes,['first','second']);
 assert.equal(stored.get('page-c'),'second');
});

test('SQLite errors are reported without marking a page saved',async()=>{
 let failing=true;
 const stored=new Map();
 const repo={
  updateContent:async(id,content)=>{if(failing)throw new Error('disk failure');stored.set(id,content)},
  getStoredContent:async id=>stored.get(id)??null
 };
 const s=load('features/canvas/store/pagePersistence.ts',{'@/db/repositories/pageRepository':{pageRepository:repo}});
 s.enqueuePageSave('page-d','new');
 await assert.rejects(s.flushPageSave('page-d'));
 assert.equal(s.getPageSaveStatus('page-d'),'error');
 failing=false;
 await s.flushPageSave('page-d');
 assert.equal(stored.get('page-d'),'new');
});

test('eraser deletion applied to stale canvas props never restores older ink',()=>{
 const {reconcileById}=load('features/canvas/engine/reconcilePageEdit.ts');
 const a={id:'a',tool:'pen'},b={id:'b',tool:'pen'},c={id:'c',tool:'pen'};
 assert.deepEqual(reconcileById([a,b],[b],[a,b,c]).map(x=>x.id),['b','c']);
 assert.deepEqual(reconcileById([a,b],[],[a,b]).map(x=>x.id),[]);
 // A second delayed edit referring to an already erased item cannot restore it.
 assert.deepEqual(reconcileById([a,b],[a],[b,c]).map(x=>x.id),['c']);
});
