import * as Crypto from 'expo-crypto';
import { getDatabase,withSafeTransaction } from '@/db/database';
export type Folder={id:string;name:string;position:number;createdAt:string};
export type FolderWithCount=Folder & {count:number};
const convert=(r:{id:string;name:string;position:number;created_at:string})=>({id:r.id,name:r.name,position:r.position,createdAt:r.created_at});
export const folderRepository={
 async getAll():Promise<Folder[]>{const db=await getDatabase();return (await db.getAllAsync<{id:string;name:string;position:number;created_at:string}>('SELECT * FROM folders ORDER BY position')).map(convert)},
 async getAllWithCounts():Promise<FolderWithCount[]>{const db=await getDatabase();const rows=await db.getAllAsync<{id:string;name:string;position:number;created_at:string;count:number}>('SELECT f.*,COUNT(n.id) AS count FROM folders f LEFT JOIN notebooks n ON n.folder_id=f.id AND n.deleted_at IS NULL GROUP BY f.id ORDER BY f.position');return rows.map(r=>({...convert(r),count:r.count}))},
 async assertName(name:string,exceptId?:string){const all=await this.getAll();if(all.some(f=>f.id!==exceptId&&f.name.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))throw new Error('Bu adda bir klasör zaten var')},
 async create(name:string){name=name.trim();if(!name)throw new Error('Klasör adı boş olamaz');await this.assertName(name);const db=await getDatabase();const count=await db.getFirstAsync<{position:number}>('SELECT COALESCE(MAX(position),-1)+1 AS position FROM folders');const id=Crypto.randomUUID();await db.runAsync('INSERT INTO folders(id,name,position,created_at) VALUES(?,?,?,?)',id,name,count?.position??0,new Date().toISOString());return id},
 async rename(id:string,name:string){name=name.trim();if(!name)throw new Error('Klasör adı boş olamaz');await this.assertName(name,id);const db=await getDatabase();await db.runAsync('UPDATE folders SET name=? WHERE id=?',name,id)},
 async remove(id:string){const db=await getDatabase();await withSafeTransaction(db,async tx=>{await tx.runAsync('DELETE FROM folders WHERE id=?',id)})},
 async reorder(orderedIds:string[]){const db=await getDatabase();await withSafeTransaction(db,async tx=>{for(let i=0;i<orderedIds.length;i++)await tx.runAsync('UPDATE folders SET position=? WHERE id=?',i,orderedIds[i])})},
 async getNotebooks(folderId:string|null){const db=await getDatabase();return db.getAllAsync<{id:string}>('SELECT id FROM notebooks WHERE folder_id IS ? AND deleted_at IS NULL ORDER BY updated_at DESC',folderId)}
};
