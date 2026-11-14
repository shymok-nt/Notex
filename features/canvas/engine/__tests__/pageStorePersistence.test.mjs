import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,imports){
 const source=readFileSync(resolve(process.cwd(),path),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 vm.runInNewContext(output,{
  module:mod,exports:mod.exports,
  require:key=>{if(Object.hasOwn(imports,key))return imports[key];throw new Error('Unexpected '+key)},
  __DEV__:false,setTimeout,clearTimeout,console,Date
 },{filename:path});
 return mod.exports;
}

function createFixture(){
 const records=new Map([
  ['a',{id:'a',notebookId:'nb',position:0,content:'{"v":2,"elements":[{"id":"ink"}]}',template:'boş',paperColor:'beyaz'}],
  ['b',{id:'b',notebookId:'nb',position:1,content:'{"v":2,"elements":[]}',template:'boş',paperColor:'beyaz'}]
 ]);
 const events=[];
 let reads=0,serial=0;
 const byNotebook=async id=>{
  reads++;return [...records.values()].filter(p=>p.notebookId===id).sort((a,b)=>a.position-b.position).map(p=>({...p}))
 };
 const repo={
  getByNotebook:byNotebook,
  getByIds:async ids=>ids.map(id=>records.get(id)).filter(Boolean).map(p=>({...p})),
  add:async(nb,position)=>{
   const id='new-'+(++serial);
   const pages=[...records.values()].filter(p=>p.notebookId===nb);
   const insert=Math.min(pages.length,position+1);
   for(const p of pages){if(p.position>=insert)p.position++}
   records.set(id,{id,notebookId:nb,position:insert,content:'',template:'boş',paperColor:'beyaz'});
   events.push('db-add');return id;
  },
  remove:async id=>{
   events.push('db-delete');records.delete(id);
   [...records.values()].sort((a,b)=>a.position-b.position).forEach((p,i)=>p.position=i)
  },
  move:async(id,position)=>{events.push('db-move');const values=[...records.values()].sort((a,b)=>a.position-b.position);const at=values.findIndex(p=>p.id===id);const [row]=values.splice(at,1);values.splice(position,0,row);values.forEach((p,i)=>p.position=i)},
  updateContent:async(id,content)=>{
   events.push('db-write');const row=records.get(id);if(!row)throw new Error('missing');row.content=content
  },
  getStoredContent:async id=>records.get(id)?.content??null
 };
 const persistence=load('features/canvas/store/pagePersistence.ts',{'@/db/repositories/pageRepository':{pageRepository:repo}});
 function create(creator){
  let state;
  const set=next=>{state={...state,...(typeof next==='function'?next(state):next)};events.push('state-change')};
  const get=()=>state;
  state=creator(set,get);
  const hook=()=>state;hook.getState=get;return hook;
 }
 const store=load('store/pageStore.ts',{
  zustand:{create},
  'react-native':{Alert:{alert:(...args)=>{events.push('alert');throw new Error(args.join(' '))}}},
  '@/db/repositories/pageRepository':{pageRepository:repo},
  '@/store/notebookStore':{useNotebookStore:{getState:()=>({refresh:async()=>{}})}},
  '@/features/canvas/engine/performance':{perfNow:()=>0},
  '@/features/canvas/store/pagePersistence':persistence,
  '@/utils/tauriFiles':{isTauriDesktop:()=>false}
 }).usePageStore;
 return {records,events,persistence,store,get reads(){return reads}};
}

test('add, change content, switch notebooks and return: SQLite data remains',async()=>{
 const f=createFixture();
 await f.store.getState().load('nb');
 const id=await f.store.getState().add(0);
 assert.ok(id);
 const text='{"v":2,"elements":[],"images":[]}';
 assert.equal(f.store.getState().cacheContent(id,text),true);
 await f.persistence.flushPageSave(id);
 await f.store.getState().load('other');
 await f.store.getState().load('nb');
 assert.equal(f.store.getState().pages.find(p=>p.id===id)?.content,text);
});

test('deleting all ink, then switching pages, keeps empty elements persisted',async()=>{
 const f=createFixture();
 await f.store.getState().load('nb');
 const empty='{"v":2,"elements":[]}';
 assert.equal(f.store.getState().cacheContent('a',empty),true);
 await f.persistence.flushPageSave('a');
 assert.equal(f.records.get('a').content,empty);
 await f.store.getState().load('other');
 await f.store.getState().load('nb');
 assert.equal(f.store.getState().pages.find(p=>p.id==='a')?.content,empty);
});

test('page deletion updates SQLite first, never resurrects on reload',async()=>{
 const f=createFixture();
 await f.store.getState().load('nb');
 f.events.length=0;
 await f.store.getState().remove('a');
 assert.ok(f.events.indexOf('db-delete')>=0);
 assert.ok(f.events.indexOf('db-delete')<f.events.indexOf('state-change'));
 assert.equal(f.records.has('a'),false);
 assert.equal(f.store.getState().pages.some(p=>p.id==='a'),false);
 await f.store.getState().load('other');
 await f.store.getState().load('nb');
 assert.equal(f.store.getState().pages.some(p=>p.id==='a'),false);
});

test('edits and deletes never flip the page loading state or refetch the list',async()=>{
 const f=createFixture();
 await f.store.getState().load('nb');
 const reads=f.reads;
 f.store.getState().cacheContent('a','');
 await f.persistence.flushPageSave('a');
 await f.store.getState().move('b',0);
 await f.store.getState().remove('b');
 assert.equal(f.store.getState().loading,false);
 assert.equal(f.reads,reads);
 assert.equal(f.records.get('a').content,'');
});
