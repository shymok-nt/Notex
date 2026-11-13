import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('dist');
const port=1431;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};

http.createServer(async(request,response)=>{
 try{
  const pathname=decodeURIComponent(new URL(request.url??'/',`http://127.0.0.1:${port}`).pathname);
  const candidate=path.resolve(root,`.${pathname}`);
  if(candidate!==root&&!candidate.startsWith(root+path.sep))throw new Error('Invalid path');
  let file=candidate;
  let stats=await fs.stat(file).catch(()=>null);
  if(!stats?.isFile()){
   if(path.extname(pathname)){response.writeHead(404);response.end('Not found');return;}
   file=path.join(root,'index.html');stats=await fs.stat(file);
  }
  const data=await fs.readFile(file);
  response.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]??'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});
  response.end(data);
 }catch(error){console.error('[Notex Tauri serve]',error);response.writeHead(500);response.end('Static app could not be served');}
}).listen(port,'127.0.0.1',()=>console.log(`[Notex] Tauri SPA server: http://127.0.0.1:${port}`));
