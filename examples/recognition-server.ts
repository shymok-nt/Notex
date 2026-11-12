/**
 * Example Node 20+ / TypeScript backend.
 * Start with: OPENAI_API_KEY=... npx tsx examples/recognition-server.ts
 * Configure EXPO_PUBLIC_API_URL=http://<server-ip>:8787/recognize in the Expo app.
 * Never expose OPENAI_API_KEY through EXPO_PUBLIC_ variables.
 */
import {createServer} from 'node:http';

const PORT=Number(process.env.PORT??8787);
const API_KEY=process.env.OPENAI_API_KEY;
const MODEL=process.env.VISION_MODEL??'gpt-4.1-mini';
const MAX_IMAGES=40;
const MAX_BODY=5_000_000;
const PROMPT='Bu görüntülerdeki el yazısı kelimeleri aynen, sırayla, Türkçe karakterleri (ı, İ, ş, ğ, ç, ö, ü) koruyarak JSON dizisi olarak döndür. Başka hiçbir şey yazma. Her görüntü için tam bir dizi elemanı döndür.';

createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 // In production: authenticate clients, add rate limits and an explicit CORS allowlist.
 res.setHeader('Access-Control-Allow-Origin',process.env.ALLOWED_ORIGIN??'http://localhost:8081');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return}
 if(req.method!=='POST'||req.url!=='/recognize'){res.writeHead(404).end(JSON.stringify({error:'Not found'}));return}
 if(!API_KEY){res.writeHead(503).end(JSON.stringify({error:'Recognition service not configured'}));return}
 try{
  const chunks:Buffer[]=[];let bytes=0;
  for await(const chunk of req){const buffer=Buffer.from(chunk as Uint8Array);bytes+=buffer.length;if(bytes>MAX_BODY)throw new Error('Payload too large');chunks.push(buffer)}
  const data:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const body=data as {images?:unknown;lang?:unknown};
  if(!body||body.lang!=='tr'||!Array.isArray(body.images)||body.images.length<1||body.images.length>MAX_IMAGES||!body.images.every(v=>typeof v==='string'&&v.length>0&&v.length<500_000&&/^[a-zA-Z0-9+/=]+$/.test(v))){
   res.writeHead(400).end(JSON.stringify({error:'Invalid images or lang'}));return;
  }
  const images=body.images as string[];
  const messages=[{role:'user',content:[{type:'text',text:PROMPT},...images.map(image=>({type:'image_url',image_url:{url:'data:image/png;base64,'+image}}))]}];
  const upstream=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages,temperature:0,max_tokens:1500})});
  if(!upstream.ok)throw new Error('Vision provider error: '+upstream.status);
  const result=await upstream.json() as {choices?:Array<{message?:{content?:string}}>};
  const raw=result.choices?.[0]?.message?.content??'';
  const words:unknown=JSON.parse(raw);
  if(!Array.isArray(words)||words.length!==images.length||!words.every(v=>typeof v==='string'))throw new Error('Unexpected model output');
  res.writeHead(200).end(JSON.stringify({words}));
 }catch(error){
  const message=error instanceof Error?error.message:'Recognition failed';
  const status=message==='Payload too large'?413:502;
  console.error('Recognition request failed:',message);
  res.writeHead(status).end(JSON.stringify({error:status===413?'Request too large':'Recognition failed'}));
 }
}).listen(PORT,()=>console.log('Recognition backend listening on port '+PORT));
