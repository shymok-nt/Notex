import * as SQLite from 'expo-sqlite';
import {Platform} from 'react-native';
import { migrations,latestMigrationVersion } from '@/db/migrations';
type DatabaseState={instance:Promise<SQLite.SQLiteDatabase>|null;webLockHeld:boolean;webLockPending?:Promise<void>|null;releaseWebLock?:()=>void};
const webGlobal=globalThis as typeof globalThis & {__notexDatabaseState?:DatabaseState};
// Keep the same connection across web Fast Refresh. A new Expo SQLite worker
// would try to open the OPFS access handles still owned by the previous worker.
const state:DatabaseState=Platform.OS==='web'?(webGlobal.__notexDatabaseState??={instance:null,webLockHeld:false}):{instance:null,webLockHeld:false};
const webBusyMessage='Notex veritabanı başka bir tarayıcı sekmesinde açık. Diğer Notex sekmesini kapatıp burada Tekrar dene seçeneğine dokun. Veriler silinmedi.';
const webAccessMessage='Web SQLite dosyasına erişilemedi. Aynı sekmedeki eski SQLite bağlantısı veya başka bir sekmenin dosya erişimi buna neden olabilir. Diğer Notex sekmelerini kapatıp bu sayfayı yenile. Veriler silinmedi.';
function releaseWebDatabaseLock(){
 const release=state.releaseWebLock;
 state.releaseWebLock=undefined;
 state.webLockHeld=false;
 release?.();
}
async function reserveWebDatabase(){
 if(Platform.OS!=='web'||typeof navigator==='undefined'||!navigator.locks)return;
 if(state.webLockHeld){
  if(!state.releaseWebLock&&!state.instance)throw new Error('Önceki geliştirme oturumunun SQLite kilidi bu sekmede kaldı. Bu sayfayı yenileyip tekrar dene; veriler silinmedi.');
  return;
 }
 if(state.webLockPending)return state.webLockPending;
 const pending=new Promise<void>((resolve,reject)=>{
  let acquired=false;
  void navigator.locks.request('notex-expo-sqlite-opfs',{ifAvailable:true,mode:'exclusive'},async lock=>{
   if(!lock){reject(new Error(webBusyMessage));return;}
   acquired=true;
   await new Promise<void>(release=>{state.releaseWebLock=release;state.webLockHeld=true;resolve();});
  }).catch(error=>{
   if(!acquired)reject(new Error('Web Locks API kilidi alınamadı. Tarayıcı izinlerini kontrol edip tekrar dene.',{cause:error}));
   else console.error('Notex web veritabanı kilidi kaybedildi',error);
  });
 });
 state.webLockPending=pending;
 try{await pending}finally{if(state.webLockPending===pending)state.webLockPending=null}
}
// Expo SQLite web does not implement withExclusiveTransactionAsync.
// Web uses the supported transaction API; native keeps exclusive transactions.
export async function withSafeTransaction<T>(db:SQLite.SQLiteDatabase,run:(tx:SQLite.SQLiteDatabase)=>Promise<T>):Promise<T>{
 if(Platform.OS==='web'){
  let result!:T;
  await db.withTransactionAsync(async()=>{result=await run(db)});
  return result;
 }
 let result!:T;
 await db.withExclusiveTransactionAsync(async tx=>{result=await run(tx as SQLite.SQLiteDatabase)});
 return result;
}
async function openAndMigrate(){
 await reserveWebDatabase();
 let db:SQLite.SQLiteDatabase|undefined;
 try{
  db=await SQLite.openDatabaseAsync('notex.db');
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const result=await db.getFirstAsync<{user_version:number}>('PRAGMA user_version');
  const current=result?.user_version??0;
  for(const migration of migrations.filter(m=>m.version>current&&m.version<=latestMigrationVersion).sort((a,b)=>a.version-b.version)){
   await withSafeTransaction(db,async tx=>{
    await migration.run(tx);
    await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
   });
  }
  return db;
 }
 catch(error){
  if(db){
   try{await db.closeAsync()}
   catch(closeError){console.error('Notex SQLite bağlantısı kapatılamadı',closeError);throw error}
  }
  if(Platform.OS==='web')releaseWebDatabaseLock();
  if(Platform.OS==='web'&&String(error).includes('createSyncAccessHandle'))throw new Error(webAccessMessage,{cause:error});
  throw error;
 }
}
export function getDatabase(){if(!state.instance){const attempt=openAndMigrate();state.instance=attempt;void attempt.catch(()=>{if(state.instance===attempt)state.instance=null});}return state.instance;}
export async function retryDatabase(){return getDatabase();}
