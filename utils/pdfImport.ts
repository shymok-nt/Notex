export type PdfImportProgress=(completed:number,total:number,label:string)=>void;
export type ImportedPdfPage={id:string;content:string;thumbnailPath:string|null};
export type PreparedPdfImport={title:string;pages:ImportedPdfPage[];assetPaths:string[]};

export async function preparePdfImport(_onProgress:PdfImportProgress):Promise<PreparedPdfImport>{
 throw new Error('PDF içe aktarma bu platformda desteklenmiyor.');
}

export async function cleanupPreparedPdfImport(prepared:PreparedPdfImport){
 const {deleteStoredFile}=await import('@/utils/tauriFiles');
 await Promise.allSettled(prepared.assetPaths.map(path=>deleteStoredFile(path)));
}
