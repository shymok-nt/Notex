const storedImagePathPattern=/^(?:covers|images|page-assets|thumbnails)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif|heic)$/i;

/** Safe relative URI stored for a file owned by the desktop app-data store. */
export function isStoredImagePath(uri:string){
 return storedImagePathPattern.test(uri);
}
