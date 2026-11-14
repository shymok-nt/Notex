import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';
import {DatabaseSync} from 'node:sqlite';

function load(path,imports={}){
 const source=readFileSync(resolve(process.cwd(),path),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:key=>{if(Object.hasOwn(imports,key))return imports[key];throw Error('Unexpected import '+key)},console,setTimeout,clearTimeout,Date,Uint8Array,atob,btoa,__DEV__:false},{filename:path});
 return module.exports;
}
function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'notex-cards-'));
 const filename=join(directory,'cards.db');let raw;
 const open=()=>{raw=new DatabaseSync(filename);raw.exec('PRAGMA foreign_keys=ON');return {
  execAsync:async sql=>raw.exec(sql),
  runAsync:async(sql,...args)=>raw.prepare(sql).run(...args),
  getAllAsync:async(sql,...args)=>raw.prepare(sql).all(...args),
  getFirstAsync:async(sql,...args)=>raw.prepare(sql).get(...args)??null,
 }};
 let db=open();const getDatabase=async()=>db;
 const withSafeTransaction=async(_db,run)=>{raw.exec('BEGIN');try{const result=await run(db);raw.exec('COMMIT');return result}catch(error){raw.exec('ROLLBACK');throw error}};
 const migration=load('db/migrations.ts').migrations;
 const scheduler=load('features/cards/scheduler.ts');
 const repository=load('db/repositories/cardRepository.ts',{'expo-crypto':{randomUUID},'@/db/database':{getDatabase,withSafeTransaction},'@/features/cards/scheduler':scheduler}).cardRepository;
 const backup=load('services/notexBackup.ts',{'jszip':JSZip,'expo-crypto':{randomUUID},'expo-file-system':{File:class{},Directory:class{},Paths:{document:''}},'react-native':{Platform:{OS:'web'}},'@/db/database':{getDatabase,withSafeTransaction},'@/utils/files':{coverPathFromUri:()=>null},'@/utils/tauriFiles':{deleteStoredFile:async()=>{},isTauriDesktop:()=>true,readStoredFile:async()=>new Uint8Array(),restoreBackupAsset:async()=>''}});
 return {db:()=>db,raw:()=>raw,repository,scheduler,backup,async migrate(){for(const item of migration)await item.run(db)},close(){raw.close()},reopen(){db=open()},dispose(){raw.close();rmSync(directory,{recursive:true,force:true})}};
}
const notebook=async f=>{const id=randomUUID();await f.db().runAsync("INSERT INTO notebooks(id,title,cover_type,template,paper_color,created_at,updated_at) VALUES(?,'Kaynak not','color','boş','beyaz',?,?)",id,new Date().toISOString(),new Date().toISOString());return id};

test('a, b, d, e: selected text becomes an independent card and survives restart and note deletion',async()=>{
 const f=fixture();try{await f.migrate();const noteId=await notebook(f);const pageId=randomUUID();const content='{"v":2,"elements":[{"id":"text","type":"text","text":"Seçilen yazı"}]}';await f.db().runAsync("INSERT INTO pages(id,notebook_id,position,template,paper_color,content,created_at,updated_at) VALUES(?,?,0,'boş','beyaz',?,?,?)",pageId,noteId,content,new Date().toISOString(),new Date().toISOString());
 const deck=await f.repository.createDeck('Deste','#3347D9');const source=await f.repository.createCard(deck.id,'Seçilen yazı','Cevap',noteId);await f.repository.createMany(deck.id,Array.from({length:4},(_,i)=>({front:`Soru ${i}`,back:`Cevap ${i}`})));
 assert.equal((await f.db().getFirstAsync('SELECT content FROM pages WHERE id=?',pageId)).content,content);
 assert.equal((await f.repository.all()).cards.length,5);await f.repository.rate(source,'good');f.close();f.reopen();let data=await f.repository.all();assert.equal(data.cards.length,5);assert.equal(data.reviews.length,1);
 await f.db().runAsync('UPDATE notebooks SET deleted_at=? WHERE id=?',new Date().toISOString(),noteId);data=await f.repository.all();assert.equal(data.cards.length,5);assert.equal(data.cards.find(c=>c.id===source.id).sourceNoteId,null);
 }finally{f.dispose()}
});
test('c: local-day scheduling advances Easy and repeats Again today',()=>{
 const s=load('features/cards/scheduler.ts');const card={id:'c',deckId:'d',front:'',back:'',sourceNoteId:null,createdAt:'',ease:2.5,interval:0,repetitions:0,dueDate:'',lastReviewed:null};const at=new Date(2026,10,15,23,59,0);
 const easy=s.nextReview(card,'easy',at);assert.ok(easy.dueDate>s.localDay(at));assert.ok(easy.interval>=4);
 const again=s.nextReview(card,'again',at);assert.equal(again.interval,1);assert.equal(again.dueDate,s.localDay(at));assert.equal(again.repetitions,0);assert.equal(s.dueCards([again],s.localDay(at)).length,1);
 assert.equal(s.addLocalDays(new Date(2026,2,28,23,59),1),'2026-03-29');
});
test('f: deck removal either moves cards or cascades cards and reviews',async()=>{const f=fixture();try{await f.migrate();const d=await f.repository.createDeck('Silinecek','#3347D9');const target=await f.repository.createDeck('Hedef','#7B5CD6');const c=await f.repository.createCard(d.id,'','');await f.repository.rate(c,'good');await f.repository.deleteDeck(d.id,target.id);let all=await f.repository.all();assert.equal(all.cards[0].deckId,target.id);assert.equal(all.reviews.length,1);await f.repository.deleteDeck(target.id);all=await f.repository.all();assert.equal(all.decks.length,0);assert.equal(all.cards.length,0);assert.equal(all.reviews.length,0);const source=readFileSync(resolve('app/(tabs)/cards.tsx'),'utf8');assert.match(source,/Kartlarla birlikte sil/);assert.match(source,/confirmDelete/)}finally{f.dispose()}});
test('g, h: backup restores cards and progress; format 1 without cards remains valid',async()=>{const f=fixture();try{await f.migrate();const d=await f.repository.createDeck('Yedek','#3347D9');const c=await f.repository.createCard(d.id,'Ön','Arka');await f.repository.rate(c,'easy');const bytes=await f.backup.createBackup(()=>{});const inspected=await f.backup.inspectBackup(bytes);assert.equal(inspected.manifest.format,2);assert.equal(inspected.manifest.counts.cards,1);await f.repository.deleteDeck(d.id);await f.backup.importBackup(bytes,()=>{});let all=await f.repository.all();assert.equal(all.decks.length,1);assert.equal(all.cards.length,1);assert.equal(all.reviews.length,1);assert.equal(all.cards[0].interval,4);
 const old=new JSZip();old.file('manifest.json',JSON.stringify({format:1,counts:{folders:0,notebooks:0,pages:0,files:0}}));old.file('data.json',JSON.stringify({folders:[],notebooks:[],pages:[],settings:[]}));await f.backup.importBackup(await old.generateAsync({type:'uint8array'}),()=>{});all=await f.repository.all();assert.equal(all.cards.length,1);
 }finally{f.dispose()}});
test('i: one thousand cards load and due selection without a long pause',async()=>{const f=fixture();try{await f.migrate();const d=await f.repository.createDeck('Büyük','#3347D9');const began=performance.now();await f.repository.createMany(d.id,Array.from({length:1000},(_,i)=>({front:`Soru ${i}`,back:`Cevap ${i}`})));const all=await f.repository.all();const due=f.scheduler.dueCards(all.cards,undefined,1000);assert.equal(due.length,1000);assert.ok(performance.now()-began<5000)}finally{f.dispose()}});
test('j: study keyboard handler excludes editable targets and supports Space, 1-4, Escape',()=>{const source=readFileSync(resolve('app/cards-study.tsx'),'utf8');assert.match(source,/event\.code==='Space'/);assert.match(source,/event\.key==='Escape'/);assert.match(source,/ratings\.find\(x=>x\[2\]===event\.key\)/);assert.match(source,/input,textarea,select/)});
test('bulk import accepts ::, tab and quoted CSV while preserving empty faces',()=>{const transfer=load('features/cards/transfer.ts');const rows=transfer.parseCardText('soru :: cevap\nAnki\tYanıt\n"a,b","c"\n :: boş arka');assert.equal(rows.length,4);assert.deepEqual(JSON.parse(JSON.stringify(rows[2])),{front:'a,b',back:'c'});assert.equal(rows[3].front,'');assert.equal(transfer.parseCardText(transfer.exportCardText(rows)).length,4)});
test('daily new-card limit persists across sessions from first review dates',()=>{const s=load('features/cards/scheduler.ts');const at=new Date(2026,10,15,23,59);const today=s.localDay(at);const reviews=[{cardId:'a',rating:'good',reviewedAt:at.toISOString()},{cardId:'a',rating:'again',reviewedAt:at.toISOString()},{cardId:'b',rating:'good',reviewedAt:at.toISOString()}];assert.equal(s.remainingNewLimit(reviews,20,today),18)});
