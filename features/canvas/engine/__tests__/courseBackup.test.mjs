import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';

function fixture(){
 const stored={folders:[],notebooks:[],pages:[],settings:[],courses:[],topics:[],pdfSearchIndex:[]};
 let sequence=0;
 const uuid=()=>('generated-'+(++sequence));
 const db={
  getAllAsync:async sql=>{
   if(sql.includes('FROM folders'))return stored.folders;
   if(sql.includes('FROM notebooks'))return stored.notebooks;
   if(sql.includes('FROM pages'))return stored.pages;
   if(sql.includes('FROM settings'))return stored.settings;
   if(sql.includes('FROM courses'))return stored.courses;
   if(sql.includes('FROM topics'))return stored.topics;
   if(sql.includes('FROM pdf_search_index'))return stored.pdfSearchIndex;
   throw Error('Unexpected query '+sql);
  },
  runAsync:async(sql,...args)=>{
   if(sql.includes('INSERT INTO courses'))stored.courses.push({id:args[0],name:args[1],color:args[2],icon:args[3],sort_order:args[4],created_at:args[5]});
   else if(sql.includes('INSERT INTO topics'))stored.topics.push({id:args[0],course_id:args[1],name:args[2],sort_order:args[3],created_at:args[4]});
   else if(sql.includes('INSERT INTO notebooks'))stored.notebooks.push({id:args[0],title:args[1],folder_id:args[2],course_id:args[3],topic_id:args[4]});
   else if(sql.includes('INSERT INTO pages'))stored.pages.push({id:args[0],notebook_id:args[1],content:args[5]});
   else if(sql.includes('INSERT INTO pdf_search_index'))stored.pdfSearchIndex.push({page_id:args[0],search_text:args[1],extractable:args[2]});
   else if(sql.includes('INSERT INTO folders'))stored.folders.push({id:args[0],name:args[1]});
   else throw Error('Unexpected insert '+sql);
  }
 };
 const mocks={
  jszip:JSZip,
  'expo-crypto':{randomUUID:uuid},
  'expo-file-system':{File:class{},Directory:class{},Paths:{}},
  'react-native':{Platform:{OS:'android'}},
  '@/db/database':{getDatabase:async()=>db,withSafeTransaction:async(_db,cb)=>cb(db)},
  '@/utils/files':{coverPathFromUri:()=>null},
  '@/utils/tauriFiles':{deleteStoredFile:async()=>{},isTauriDesktop:()=>false,readStoredFile:async()=>new Uint8Array(),restoreBackupAsset:async()=>''},
  '@/store/pageStore':{usePageStore:{getState:()=>({pages:[]})}},
  '@/features/canvas/store/pagePersistence':{flushPageSave:async()=>{}}
 };
 const code=ts.transpileModule(readFileSync(resolve(process.cwd(),'services/notexBackup.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(name in mocks)return mocks[name];throw Error('Unexpected import '+name)},console,Uint8Array,Date,Math,Set,Map,Promise,setTimeout,clearTimeout,atob,btoa},{filename:'notexBackup.ts'});
 return {store:stored,api:module.exports};
}
const oldNotebook={id:'old-n',title:'Eski not',folder_id:null,cover_type:'color',cover_color:'#3347D9',cover_image_path:null,cover_preset_id:null,show_title_on_cover:1,template:'boş',paper_color:'beyaz',favorite:0,created_at:'2026',updated_at:'2026',deleted_at:null};
const oldPage={id:'old-p',notebook_id:'old-n',position:0,template:'boş',paper_color:'beyaz',content:JSON.stringify({v:2,elements:[]}),thumbnail_path:null,created_at:'2026',updated_at:'2026'};
async function archive(data,schemaVersion){
 const zip=new JSZip();
 zip.file('manifest.json',JSON.stringify({format:1,...(schemaVersion===undefined?{}:{schemaVersion}),appVersion:'1.0.0',exportedAt:'2026',counts:{folders:data.folders.length,notebooks:data.notebooks.length,pages:data.pages.length,files:0}}));
 zip.file('data.json',JSON.stringify(data));
 return zip.generateAsync({type:'uint8array'});
}
test('old .notex backup without courses/topics restores notes as unclassified',async()=>{
 const f=fixture();
 const bytes=await archive({folders:[],notebooks:[oldNotebook],pages:[oldPage],settings:[]});
 await f.api.importBackup(bytes,()=>{});
 assert.equal(f.store.notebooks.length,1);
 assert.equal(f.store.notebooks[0].course_id,null);
 assert.equal(f.store.notebooks[0].topic_id,null);
 assert.equal(f.store.pages[0].content,oldPage.content);
});
test('v3 .notex restores course, topic, note link and indexed PDF search text',async()=>{
 const f=fixture();
 const data={
  folders:[],
  notebooks:[{...oldNotebook,course_id:'course1',topic_id:'topic1'}],
  pages:[oldPage],settings:[],
  courses:[{id:'course1',name:'Fizik',color:'#3347D9',icon:'📘',sort_order:0,created_at:'2026'}],
  topics:[{id:'topic1',course_id:'course1',name:'Hareket',sort_order:0,created_at:'2026'}],
  pdfSearchIndex:[{page_id:'old-p',search_text:'ivme kuvvet',extractable:1}]
 };
 await f.api.importBackup(await archive(data,3),()=>{});
 assert.equal(f.store.courses.length,1);assert.equal(f.store.topics.length,1);
 assert.equal(f.store.notebooks[0].course_id,f.store.courses[0].id);
 assert.equal(f.store.notebooks[0].topic_id,f.store.topics[0].id);
 assert.equal(f.store.pdfSearchIndex[0].page_id,f.store.pages[0].id);
 assert.equal(f.store.pdfSearchIndex[0].search_text,'ivme kuvvet');
});
test('new backup includes schemaVersion 3 and links without changing format 1',async()=>{
 const f=fixture();
 f.store.notebooks.push({...oldNotebook,course_id:'c1',topic_id:'t1'});
 f.store.pages.push(oldPage);
 f.store.courses.push({id:'c1',name:'Fizik',color:'#3347D9',icon:'📘',sort_order:0,created_at:'2026'});
 f.store.topics.push({id:'t1',course_id:'c1',name:'Hareket',sort_order:0,created_at:'2026'});
 f.store.pdfSearchIndex.push({page_id:'old-p',search_text:'ivme',extractable:1});
 const bytes=await f.api.createBackup(()=>{});
 const zip=await JSZip.loadAsync(bytes);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 const data=JSON.parse(await zip.file('data.json').async('string'));
 assert.equal(manifest.format,1);
 assert.equal(manifest.schemaVersion,3);
 assert.equal(data.courses[0].id,'c1');
 assert.equal(data.topics[0].id,'t1');
 assert.equal(data.notebooks[0].course_id,'c1');
 assert.equal(data.pdfSearchIndex[0].search_text,'ivme');
});
