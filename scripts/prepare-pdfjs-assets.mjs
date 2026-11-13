import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageRoot=path.join(root,'node_modules','pdfjs-dist');
const targetRoot=path.join(root,'public','pdfjs');
const assets=[
 ['legacy/build/pdf.worker.min.mjs','pdf.worker.min.mjs'],
 ['cmaps','cmaps'],
 ['standard_fonts','standard_fonts'],
 ['wasm','wasm'],
 ['iccs','iccs'],
];

for(const [sourceRelative,targetRelative] of assets){
 const source=path.join(packageRoot,sourceRelative);
 const target=path.join(targetRoot,targetRelative);
 if(!fs.existsSync(source))throw new Error(`PDF.js asset not found: ${sourceRelative}`);
 if(fs.statSync(source).isDirectory())fs.cpSync(source,target,{recursive:true,force:true});
 else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)}
}
console.log('[Notex] PDF.js local worker and rendering assets ready: public/pdfjs');
