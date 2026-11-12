// Web implementation: do not instantiate expo-file-system Directory/Paths.
// Image picker returns browser-accessible URIs that can be used directly.
export async function copyCover(sourceUri:string):Promise<string>{
 return sourceUri;
}
export function deleteCover(_uri:string|null):void{
 // Browser object URLs are managed by the browser; do not delete native files.
}
export function deleteCoverIfUnused(uri:string|null,remainingUris:(string|null)[]):void{
 if(uri&&!remainingUris.includes(uri))deleteCover(uri);
}
