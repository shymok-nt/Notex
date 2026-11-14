import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks){
 const code=ts.transpileModule(readFileSync(resolve(process.cwd(),path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(Object.hasOwn(mocks,name))return mocks[name];throw Error('Unexpected import: '+name)},console,setTimeout,clearTimeout,Map,Set,Date}, {filename:path});
 return module.exports;
}
const normalize=load('features/search/searchIndex.ts',{
 '@/db/database':{getDatabase:async()=>({getAllAsync:async()=>[]})},
 '@/features/canvas/engine/content':{parseContent:raw=>JSON.parse(raw)}
}).normalizeSearch;
test('Turkish search folds dotted/dotless I and accented characters',()=>{
 assert.equal(normalize('Öğrenci'),'ogrenci');
 assert.equal(normalize('OGRenci'),'ogrenci');
 assert.equal(normalize('I İ ı i Ş Ğ Ü Ö Ç'),'i i i i s g u o c');
});
test('PDF text, text elements and course names are searched without stroke recognition',async()=>{
 const rows=[
  {id:'p1',notebook_id:'n1',position:0,content:JSON.stringify({v:2,elements:[{id:'text',type:'text',text:'Öğrenci notları'},{id:'s',type:'stroke',points:[1,2,0.4]}]}),updated_at:'2026',search_text:null,extractable:null,pdf_imported:0},
  {id:'p2',notebook_id:'n2',position:0,content:JSON.stringify({v:2,elements:[]}),updated_at:'2026',search_text:'Fizik hareket ve ivme',extractable:1,pdf_imported:1},
  {id:'p3',notebook_id:'n3',position:0,content:JSON.stringify({v:2,elements:[]}),updated_at:'2026',search_text:'',extractable:0,pdf_imported:1},
 ];
 const s=load('features/search/searchIndex.ts',{
  '@/db/database':{getDatabase:async()=>({getAllAsync:async()=>rows})},
  '@/features/canvas/engine/content':{parseContent:raw=>JSON.parse(raw)}
 });
 await s.hydrateSearchIndex();
 const meta=new Map([
  ['n1',{title:'Türkçe',courseName:'Edebiyat',topicName:'Şiir',courseId:'c1'}],
  ['n2',{title:'Kuvvet PDF',courseName:'Fizik',courseId:'c2'}],
  ['n3',{title:'Taranmış',courseId:null}]
 ]);
 assert.equal(s.searchIndexedPages('ogrenci',meta).length,1);
 assert.equal(s.searchIndexedPages('ivme',meta)[0].source,'pdf');
 assert.equal(s.searchIndexedPages('edebiyat',meta)[0].source,'course');
 assert.equal(s.searchIndexedPages('siir',meta)[0].source,'topic');
 assert.equal(s.searchIndexedPages('ogrenci',meta,'c2').length,0);
 assert.equal(s.searchIndexedPages('stroke',meta).length,0);
 assert.equal(s.countUnsearchablePdfPages(),1);
});
test('600 indexed notes remain searchable without re-reading SQLite per query',async()=>{
 let dbReads=0;
 const rows=Array.from({length:600},(_,i)=>({id:'p'+i,notebook_id:'n'+i,position:0,content:JSON.stringify({v:2,elements:[{type:'text',text:i===599?'Öğrenci kitapları':'Ders notları'}]}),updated_at:'2026',search_text:null,extractable:null,pdf_imported:0}));
 const s=load('features/search/searchIndex.ts',{
  '@/db/database':{getDatabase:async()=>({getAllAsync:async()=>{dbReads++;return rows}})},
  '@/features/canvas/engine/content':{parseContent:raw=>JSON.parse(raw)}
 });
 await s.hydrateSearchIndex();
 const metadata=new Map(rows.map((r,i)=>[r.notebook_id,{title:'Not '+i,courseId:null}]));
 for(let n=0;n<10;n++)assert.equal(s.searchIndexedPages('ogrenci',metadata).length,1);
 assert.equal(dbReads,1);
});
