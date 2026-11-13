import {invoke} from '@tauri-apps/api/core';
import type {SQLiteBindValue} from 'expo-sqlite';

type NativeRunResult={lastInsertRowId:number;changes:number};
let commandQueue:Promise<void>=Promise.resolve();

function serializeCommand<T>(operation:()=>Promise<T>):Promise<T>{
  const result=commandQueue.then(operation);
  commandQueue=result.then(()=>undefined,()=>undefined);
  return result;
}

/** Expo SQLite-shaped bridge backed by one Rust SQLite connection in Tauri. */
export class TauriDatabaseAdapter {
  constructor(private readonly transactionId?:string){}

  private request<T>(command:string,args:Record<string,unknown>):Promise<T>{
    const payload={...args,transactionId:this.transactionId??null};
    return this.transactionId?invoke<T>(command,payload):serializeCommand(()=>invoke<T>(command,payload));
  }

  async execAsync(source:string):Promise<void>{
    await this.request<void>('notex_db_exec',{query:source});
  }

  async runAsync(source:string,...params:SQLiteBindValue[]):Promise<NativeRunResult>{
    return this.request<NativeRunResult>('notex_db_run',{query:source,params});
  }

  async getAllAsync<T>(source:string,...params:SQLiteBindValue[]):Promise<T[]>{
    return this.request<T[]>('notex_db_all',{query:source,params});
  }

  async getFirstAsync<T>(source:string,...params:SQLiteBindValue[]):Promise<T|null>{
    const rows=await this.getAllAsync<T>(source,...params);
    return rows[0]??null;
  }

  async withExclusiveTransactionAsync(task:(transaction:TauriDatabaseAdapter)=>Promise<void>):Promise<void>{
    const transactionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await serializeCommand(async()=>{
      await invoke('notex_db_begin',{transactionId});
      const transaction=new TauriDatabaseAdapter(transactionId);
      try{
        await task(transaction);
        await invoke('notex_db_commit',{transactionId});
      }catch(error){
        try{await invoke('notex_db_rollback',{transactionId})}catch(rollbackError){
          console.error('Notex yerel SQLite transaction geri alınamadı',rollbackError);
        }
        throw error;
      }
    });
  }
}
