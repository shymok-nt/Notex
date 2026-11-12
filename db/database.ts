import * as SQLite from 'expo-sqlite';
import {Platform} from 'react-native';
import { migrations,latestMigrationVersion } from '@/db/migrations';
let instance:Promise<SQLite.SQLiteDatabase>|null=null;
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
 const db=await SQLite.openDatabaseAsync('notex.db');
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
export function getDatabase(){if(!instance)instance=openAndMigrate().catch(error=>{instance=null;throw error});return instance;}
export async function retryDatabase(){instance=null;return getDatabase();}
