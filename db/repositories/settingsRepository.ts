import { getDatabase } from '@/db/database';
export const settingsRepository={
 async get(key:string){const db=await getDatabase();const row=await db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?',key);return row?.value??null;},
 async set(key:string,value:string){const db=await getDatabase();await db.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value);}
};
