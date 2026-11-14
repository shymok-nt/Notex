export type CardPair={front:string;back:string};
const csvFields=(line:string)=>{const fields:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){fields.push(value);value=''}else value+=char}fields.push(value);return fields};
export const parseCardText=(text:string)=>text.replace(/^\uFEFF/,'').split(/\r?\n/).flatMap(line=>{if(!line.trim())return [];
 let fields:string[];if(line.includes('\t'))fields=line.split('\t');else if(line.includes('::')){const index=line.indexOf('::');fields=[line.slice(0,index),line.slice(index+2)]}else fields=csvFields(line);
 if(fields.length<2)return [];return [{front:fields[0].trim(),back:fields.slice(1).join(line.includes('\t')?'\t':',').trim()}];
});
export const exportCardText=(items:CardPair[])=>items.map(item=>[item.front,item.back].map(value=>'"'+value.replace(/"/g,'""')+'"').join(',')).join('\r\n');
