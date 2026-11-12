// Browser-safe cover storage adapter. Expo's native document Directory is not
// available during web module initialization.
export function resolveCoverUri(relativePath:string|null):string|null {
 if(!relativePath)return null;
 // Keep absolute web URLs usable, but do not interpret native relative paths.
 return /^(https?:|data:|blob:)/i.test(relativePath)?relativePath:null;
}
export function coverPathFromUri(uri:string|null):string|null {
 return uri&&/^(https?:|data:|blob:)/i.test(uri)?uri:null;
}
export async function copyCoverFile(sourceUri:string):Promise<string> {
 // Browser cover copies can reuse their existing accessible URL.
 if(/^(https?:|data:|blob:)/i.test(sourceUri))return sourceUri;
 throw new Error('Bu kapak dosyası web ortamında kullanılamıyor.');
}
export function deleteCoverFile(_path:string|null):void {
 // Web cover URLs are not native files and must not be deleted here.
}
export function coverFileExists(path:string|null):boolean {
 return !!path&&/^(https?:|data:|blob:)/i.test(path);
}
