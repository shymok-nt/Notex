import * as Crypto from 'expo-crypto';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { pdfPageLayout } from '@/features/canvas/engine/pdfPageLayout';
import { PAGE_HEIGHT, PAGE_WIDTH } from '@/features/canvas/types';
import { isTauriDesktop, writeStoredFile } from '@/utils/tauriFiles';
import type { ImportedPdfPage, PdfImportProgress, PreparedPdfImport } from './pdfImport';

const WORKER_URL='/pdfjs/pdf.worker.min.mjs';
// Page images are displayed at 1000 logical pixels; larger bitmaps cost
// substantially more time and storage without improving the initial view.
const PAGE_RENDER_MAX_EDGE=1600;
const PAGE_THUMBNAIL_WIDTH=96;

function canvasPng(canvas:HTMLCanvasElement):Promise<Uint8Array>{
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
  if(!blob){reject(new Error('PDF sayfa görseli PNG olarak oluşturulamadı.'));return;}
  void blob.arrayBuffer().then(buffer=>resolve(new Uint8Array(buffer)),reject);
 },'image/png'));
}

async function savePng(bytes:Uint8Array,assetPaths:string[]){
 const path=`page-assets/${Crypto.randomUUID()}.png`;
 assetPaths.push(path);
 await writeStoredFile(path,bytes);
 return path;
}

async function renderPdfPage(pdfDocument:PDFDocumentProxy,pageNumber:number,assetPaths:string[]):Promise<ImportedPdfPage>{
 const page=await pdfDocument.getPage(pageNumber);
 const baseViewport=page.getViewport({scale:1});
 const scale=Math.min(1.6,PAGE_RENDER_MAX_EDGE/Math.max(baseViewport.width,baseViewport.height));
 const viewport=page.getViewport({scale});
 const pixelWidth=Math.max(1,Math.ceil(viewport.width)),pixelHeight=Math.max(1,Math.ceil(viewport.height));
 const canvas=globalThis.document.createElement('canvas');
 canvas.width=pixelWidth;canvas.height=pixelHeight;
 const context=canvas.getContext('2d',{alpha:false});
 if(!context)throw new Error('PDF sayfası çizim alanı oluşturulamadı.');
 context.fillStyle='#FFFFFF';context.fillRect(0,0,pixelWidth,pixelHeight);
 await page.render({canvas,viewport}).promise;
 const png=await canvasPng(canvas);
 const layout=pdfPageLayout(pixelWidth,pixelHeight,PAGE_WIDTH,PAGE_HEIGHT);
 const backgroundPath=await savePng(png,assetPaths);

 const thumbnailCanvas=globalThis.document.createElement('canvas');
 const thumbnailHeight=Math.max(1,Math.round(PAGE_THUMBNAIL_WIDTH*pixelHeight/pixelWidth));
 thumbnailCanvas.width=PAGE_THUMBNAIL_WIDTH;thumbnailCanvas.height=thumbnailHeight;
 const thumbnailContext=thumbnailCanvas.getContext('2d',{alpha:false});
 if(!thumbnailContext)throw new Error('PDF sayfa küçük önizlemesi oluşturulamadı.');
 thumbnailContext.fillStyle='#FFFFFF';thumbnailContext.fillRect(0,0,thumbnailCanvas.width,thumbnailCanvas.height);
 thumbnailContext.drawImage(canvas,0,0,thumbnailCanvas.width,thumbnailCanvas.height);
 const thumbnailPath=await savePng(await canvasPng(thumbnailCanvas),assetPaths);
 canvas.width=0;canvas.height=0;thumbnailCanvas.width=0;thumbnailCanvas.height=0;
 await page.cleanup();

 const content={v:2 as const,elements:[],images:[],backgroundImage:{id:Crypto.randomUUID(),uri:backgroundPath,x:layout.x,y:layout.y,width:layout.width,height:layout.height},h:Math.max(PAGE_HEIGHT,layout.pageHeight)};
 return {id:Crypto.randomUUID(),content:JSON.stringify(content),thumbnailPath};
}

export async function preparePdfImport(onProgress:PdfImportProgress):Promise<PreparedPdfImport>{
 if(!isTauriDesktop())throw new Error('PDF içe aktarma yalnızca Notex masaüstü sürümünde kullanılabilir.');
 const selected=await open({multiple:false,directory:false,filters:[{name:'PDF dosyaları',extensions:['pdf']}]});
 if(typeof selected!=='string')return {title:'',pages:[],assetPaths:[]};
 const title=selected.split(/[\\/]/).pop()?.replace(/\.pdf$/i,'').trim()||'PDF defteri';

 let document:PDFDocumentProxy|undefined;
 let loadingTask:PDFDocumentLoadingTask|undefined;
 const assetPaths:string[]=[];
 try{
  onProgress(0,1,'PDF okunuyor…');
  const response=await fetch(convertFileSrc(selected));
  if(!response.ok)throw new Error(`Seçilen PDF okunamadı (HTTP ${response.status}).`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length)throw new Error('Seçilen PDF dosyası boş.');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=WORKER_URL;
  loadingTask=pdfjs.getDocument({data:bytes,cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',iccUrl:'/pdfjs/iccs/'});
  document=await loadingTask.promise;
  const pdfDocument=document;
  if(pdfDocument.numPages<1)throw new Error('PDF içinde görüntülenebilir sayfa bulunamadı.');
  const pages:ImportedPdfPage[]=[];
  onProgress(0,pdfDocument.numPages,'PDF sayfaları hazırlanıyor…');
  for(let pageNumber=1;pageNumber<=pdfDocument.numPages;pageNumber++){
   pages.push(await renderPdfPage(pdfDocument,pageNumber,assetPaths));
   onProgress(pageNumber,pdfDocument.numPages,`PDF sayfası ${pageNumber}/${pdfDocument.numPages} işleniyor…`);
   if(pageNumber<pdfDocument.numPages)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  return {title,pages,assetPaths};
 }catch(error){
  await Promise.allSettled(assetPaths.map(async path=>{const {deleteStoredFile}=await import('@/utils/tauriFiles');await deleteStoredFile(path)}));
  if(error instanceof Error&&/password|encrypted/i.test(error.name+' '+error.message))throw new Error('Bu PDF şifre korumalı. Şifresiz bir PDF seçin.');
  throw new Error(`PDF içe aktarılamadı: ${error instanceof Error?error.message:String(error)}`);
 }finally{
  try{await document?.destroy()}catch{}
  try{await loadingTask?.destroy()}catch{}
 }
}

export async function cleanupPreparedPdfImport(prepared:PreparedPdfImport){
 const {deleteStoredFile}=await import('@/utils/tauriFiles');
 await Promise.allSettled(prepared.assetPaths.map(path=>deleteStoredFile(path)));
}
