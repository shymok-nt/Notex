import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const raw=readFileSync(resolve(process.cwd(),'db/migrations.ts'),'utf8');
const output=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(output,{module,exports:module.exports},{filename:'db/migrations.ts'});
const {migrations,latestMigrationVersion}=module.exports;
function database(){
 const conn=new DatabaseSync(':memory:');
 const db={
  execAsync:async sql=>conn.exec(sql),
  runAsync:async(sql,...params)=>conn.prepare(sql).run(...params),
  getFirstAsync:async(sql,...params)=>conn.prepare(sql).get(...params),
  getAllAsync:async(sql,...params)=>conn.prepare(sql).all(...params)
 };
 return {conn,db};
}
test('v3 preserves existing notebook/page bytes and leaves old notes unclassified',async()=>{
 const {conn,db}=database();
 await migrations[0].run(db);
 await migrations[1].run(db);
 const content='{"v":2,"elements":[{"id":"x","type":"stroke"}]}';
 await db.runAsync("INSERT INTO notebooks(id,title,folder_id,cover_type,template,paper_color,created_at,updated_at) VALUES(?,'Öğrenci',NULL,'color','boş','beyaz','2026','2026')",'n1');
 await db.runAsync("INSERT INTO pages(id,notebook_id,position,template,paper_color,content,created_at,updated_at) VALUES('p1','n1',0,'boş','beyaz',?,'2026','2026')",content);
 conn.exec('BEGIN');
 await migrations[2].run(db);
 conn.exec('PRAGMA user_version=3;COMMIT');
 const note=await db.getFirstAsync('SELECT title,course_id,topic_id FROM notebooks WHERE id=?','n1');
 assert.equal(note.title,'Öğrenci');assert.equal(note.course_id,null);assert.equal(note.topic_id,null);
 assert.equal((await db.getFirstAsync('SELECT content FROM pages WHERE id=?','p1')).content,content);
 assert.equal((await db.getFirstAsync('SELECT content FROM migration_v3_pages_backup WHERE id=?','p1')).content,content);
 assert.equal((await db.getFirstAsync("SELECT value FROM settings WHERE key='schemaVersion'")).value,'3');
 assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version,3);
 assert.equal(latestMigrationVersion,3);
 conn.close();
});
test('failed migration rolls back and keeps old data intact',async()=>{
 const {conn,db}=database();
 await migrations[0].run(db);await migrations[1].run(db);
 await db.runAsync("INSERT INTO notebooks(id,title,folder_id,cover_type,template,paper_color,created_at,updated_at) VALUES('n1','Not',NULL,'color','boş','beyaz','2026','2026')");
 conn.exec('BEGIN');
 try{await migrations[2].run(db);throw new Error('simulated failure')}catch{conn.exec('ROLLBACK')}
 assert.equal((await db.getFirstAsync('SELECT title FROM notebooks WHERE id=?','n1')).title,'Not');
 assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version,0);
 assert.equal((await db.getAllAsync('PRAGMA table_info(notebooks)')).some(column=>column.name==='course_id'),false);
 conn.close();
});
