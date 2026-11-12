import { Directory, File, Paths } from 'expo-file-system';
const covers = new Directory(Paths.document,'covers');
export async function copyCover(sourceUri:string):Promise<string>{
 covers.create({idempotent:true,intermediates:true});
 const source=new File(sourceUri);
 const ext=source.extension?.toLowerCase()||'.jpg';
 const safeExt=['.jpg','.jpeg','.png','.webp','.heic'].includes(ext)?ext:'.jpg';
 const target=new File(covers,`cover-${Date.now()}-${Math.random().toString(36).slice(2,9)}${safeExt}`);
 source.copy(target);
 return target.uri;
}
export function deleteCover(uri:string|null){if(!uri)return;try{const file=new File(uri);if(file.exists)file.delete();}catch(e){console.warn('Kapak dosyası silinemedi',e);}}
export function deleteCoverIfUnused(uri:string|null,remainingUris:(string|null)[]){if(uri&&!remainingUris.includes(uri))deleteCover(uri);}
