import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,mocks){
 const code=ts.transpileModule(readFileSync(resolve(process.cwd(),path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(name in mocks)return mocks[name];throw Error('Unexpected '+name)},console,Date,Math,Set,Map,__DEV__:false},{filename:path});
 return module.exports;
}
let sequence=0;
async function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'notex-course-')),file=join(directory,'notex.db');
 const conn=new DatabaseSync(file);
 conn.exec('PRAGMA foreign_keys=ON');
 const db={
  execAsync:async sql=>conn.exec(sql),
  runAsync:async(sql,...params)=>conn.prepare(sql).run(...params),
  getFirstAsync:async(sql,...params)=>conn.prepare(sql).get(...params),
  getAllAsync:async(sql,...params)=>conn.prepare(sql).all(...params)
 };
 const {migrations}=load('db/migrations.ts',{});
 for(const migration of migrations)await migration.run(db);
 const mocks={
  'expo-crypto':{randomUUID:()=>('id-'+(++sequence))},
  '@/db/database':{getDatabase:async()=>db,withSafeTransaction:async(_,fn)=>{
   conn.exec('BEGIN');
   try{const result=await fn(db);conn.exec('COMMIT');return result}catch(e){conn.exec('ROLLBACK');throw e}
  }},
  '@/utils/files':{copyCoverFile:async()=>null,deleteCoverFile:()=>{},resolveCoverUri:()=>null,coverPathFromUri:()=>null},
  '@/features/canvas/engine/performance':{perfNow:()=>0},
  '@/theme/covers':{defaultCoverColor:'#3347D9'},
  '@/utils/tauriFiles':{deleteStoredFile:async()=>{},isStoredAppDataPath:()=>false,isTauriDesktop:()=>false}
 };
 const course=load('db/repositories/courseRepository.ts',mocks).courseRepository;
 const notebookMocks={...mocks,'expo-file-system':{File:class{},Directory:class{},Paths:{}}};
 const notebook=load('db/repositories/notebookRepository.ts',notebookMocks).notebookRepository;
 return {course,notebook,db,conn,file,clean:()=>{conn.close();rmSync(directory,{recursive:true,force:true})}};
}
test('course/topic add survives SQLite reopen; note moves and remains after safe course delete',async()=>{
 const f=await fixture();
 try{
  const course=await f.course.addCourse('Matematik','#3347D9','📘');
  const topic=await f.course.addTopic(course.id,'Türev');
  assert.equal(course.order,0);
  const input={title:'Öğrenci notu',folderId:null,courseId:course.id,topicId:topic.id,coverType:'color',coverColor:'#3347D9',coverImagePath:null,coverPresetId:null,showTitleOnCover:true,template:'boş',paperColor:'beyaz'};
  const noteId=await f.notebook.create(input);
  let note=await f.notebook.getById(noteId);
  assert.equal(note.course_id,course.id);assert.equal(note.topic_id,topic.id);
  const second=await f.course.addTopic(course.id,'İntegral');
  await f.course.moveNotebook(noteId,course.id,second.id);
  note=await f.notebook.getById(noteId);
  assert.equal(note.topic_id,second.id);
  await f.course.deleteCourse(course.id,'unclassify');
  note=await f.notebook.getById(noteId);
  assert.equal(note.course_id,null);
  assert.equal(note.topic_id,null);
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',noteId)).n,1);
 }finally{f.clean()}
});
test('delete topic with trash preserves note and page for trash recovery',async()=>{
 const f=await fixture();
 try{
  const course=await f.course.addCourse('Fizik');
  const topic=await f.course.addTopic(course.id,'Hareket');
  const noteId=await f.notebook.create({title:'Not',folderId:null,courseId:course.id,topicId:topic.id,coverType:'color',coverColor:'#3347D9',coverImagePath:null,showTitleOnCover:true,template:'boş',paperColor:'beyaz'});
  await f.course.deleteTopic(topic.id,'trash');
  const note=await f.db.getFirstAsync('SELECT deleted_at,course_id,topic_id FROM notebooks WHERE id=?',noteId);
  assert.ok(note.deleted_at);
  assert.equal(note.course_id,null);assert.equal(note.topic_id,null);
  assert.equal((await f.db.getFirstAsync('SELECT COUNT(*) AS n FROM pages WHERE notebook_id=?',noteId)).n,1);
 }finally{f.clean()}
});
