import { copyStoredFile, deleteStoredFile, isStoredAppDataPath, isTauriDesktop, storeSelectedImage } from '@/utils/tauriFiles';

// Web implementation: do not instantiate expo-file-system Directory/Paths.
// Image picker returns browser-accessible URIs that can be used directly.
export async function copyCover(sourceUri:string):Promise<string>{
 if(isTauriDesktop()){
  if(isStoredAppDataPath(sourceUri))return copyStoredFile(sourceUri,'covers');
  return storeSelectedImage(sourceUri,'covers');
 }
 return sourceUri;
}
export function deleteCover(uri:string|null):void{
 if(uri&&isTauriDesktop())void deleteStoredFile(uri).catch(error=>console.warn('Kapak dosyası silinemedi',error));
 // Browser object URLs are managed by the browser; do not delete native files.
}
export function deleteCoverIfUnused(uri:string|null,remainingUris:(string|null)[]):void{
 if(uri&&!remainingUris.includes(uri))deleteCover(uri);
}
