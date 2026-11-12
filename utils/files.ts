import { Directory,File,Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
const covers=new Directory(Paths.document,'covers');
export function resolveCoverUri(relativePath:string|null){if(!relativePath)return null;return new File(Paths.document,relativePath).uri;}
export function coverPathFromUri(uri:string|null){if(!uri)return null;const root=Paths.document.uri.endsWith('/')?Paths.document.uri:Paths.document.uri+'/';return uri.startsWith(root)?uri.slice(root.length):null;}
export async function copyCoverFile(sourceUri:string){
 covers.create({idempotent:true,intermediates:true});
 const source=new File(sourceUri);const ext=source.extension?.toLowerCase()||'.jpg';
 const suffix=['.jpg','.jpeg','.png','.webp','.heic'].includes(ext)?ext:'.jpg';
 const relative=`covers/${Crypto.randomUUID()}${suffix}`;
 source.copy(new File(Paths.document,relative));
 return relative;
}
export function deleteCoverFile(path:string|null){if(!path)return;try{const f=new File(Paths.document,path);if(f.exists)f.delete();}catch(error){console.warn('Kapak silinemedi',error);}}
export function coverFileExists(path:string|null){if(!path)return false;try{return new File(Paths.document,path).exists}catch{return false}}
