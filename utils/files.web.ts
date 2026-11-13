import { isTauriDesktop, copyStoredFile, storeSelectedImage } from '@/utils/tauriFiles';

const validStoredPath = (value: string) =>
  !value.startsWith('/') && !value.includes('\\') &&
  !value.split('/').some(part => !part || part === '.' || part === '..') &&
  /^[A-Za-z0-9._/-]+$/.test(value);

// Browser-safe cover storage adapter. Expo's native document Directory is not
// available during web module initialization.
export function resolveCoverUri(relativePath:string|null):string|null {
 if(!relativePath)return null;
 if(isTauriDesktop()&&validStoredPath(relativePath))return relativePath;
 // Keep absolute web URLs usable, but do not interpret native relative paths.
 return /^(https?:|data:|blob:)/i.test(relativePath)?relativePath:null;
}
export function coverPathFromUri(uri:string|null):string|null {
 if(uri&&isTauriDesktop()&&validStoredPath(uri))return uri;
 return uri&&/^(https?:|data:|blob:)/i.test(uri)?uri:null;
}
export async function copyCoverFile(sourceUri:string):Promise<string> {
 if(isTauriDesktop()){
  if(validStoredPath(sourceUri))return copyStoredFile(sourceUri,'covers');
  return storeSelectedImage(sourceUri,'covers');
 }
 // Browser cover copies can reuse their existing accessible URL.
 if(/^(https?:|data:|blob:)/i.test(sourceUri))return sourceUri;
 throw new Error('Bu kapak dosyası web ortamında kullanılamıyor.');
}
export function deleteCoverFile(path:string|null):void {
 if(path&&isTauriDesktop())void import('@/utils/tauriFiles').then(({deleteStoredFile})=>deleteStoredFile(path)).catch(error=>console.warn('Kapak silinemedi',error));
 // Web cover URLs are not native files and must not be deleted here.
}
export function coverFileExists(path:string|null):boolean {
 if(path&&isTauriDesktop())return validStoredPath(path);
 return !!path&&/^(https?:|data:|blob:)/i.test(path);
}
