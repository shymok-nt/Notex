/** Offline, device-local OCR corrections. Never changes recognized text automatically. */
const KEY='notex.ocr.userCorrections.v1';
const MAX_ENTRIES=300;
type Memory=Record<string,Record<string,number>>;
const dictionary=['güzel','gün','günaydın','görüşürüz','öğrenci','öğretmen','öğrenmek','ödev','örnek','küçük','büyük','çocuk','çok','çalışıyorum','çalışma','şimdi','teşekkür','türkçe','üniversite','üç','dün','dünya','değil','için','iyi','yarın','yazı','yıl','sınav','bahçe','başarı','akşam','arkadaş','eğitim','eğlenceli','nasıl','bugün','zaman','olur','ölür'];
const groups=['oö','uü','ıi','sş','cç','gğ'];
const related=(a:string,b:string)=>a===b||groups.some(group=>group.includes(a)&&group.includes(b));
const normalize=(text:string)=>text.trim().toLocaleLowerCase('tr-TR');
function read():Memory{
  try{
    if(typeof localStorage==='undefined')return {};
    const parsed:unknown=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
    const result:Memory={};
    for(const [source,values] of Object.entries(parsed)){
      if(!values||typeof values!=='object'||Array.isArray(values))continue;
      const candidates=Object.entries(values).filter(([word,count])=>word.length<=100&&typeof count==='number'&&Number.isFinite(count)&&count>0);
      if(candidates.length)result[source]=Object.fromEntries(candidates.slice(0,10));
    }
    return result;
  }catch{return {};}
}
export function rememberOcrCorrection(source:string,corrected:string){
  const key=normalize(source),value=corrected.trim();
  if(!key||!value||key.length>100||value.length>100||key===normalize(value))return;
  try{
    if(typeof localStorage==='undefined')return;
    const memory=read();
    memory[key]??={};
    memory[key][value]=Math.min(1000,(memory[key][value]??0)+1);
    const keys=Object.keys(memory);
    for(const old of keys.slice(0,Math.max(0,keys.length-MAX_ENTRIES)))delete memory[old];
    localStorage.setItem(KEY,JSON.stringify(memory));
  }catch{/* Storage unavailable/full: editing must still succeed. */}
}
export function suggestOcrCorrections(source:string):string[]{
  const key=normalize(source);
  if(!key||key.length>100)return [];
  const learned=Object.entries(read()[key]??{}).sort((a,b)=>b[1]-a[1]).map(([word])=>word);
  // A candidate differs only in diacritics; unknown names remain untouched.
  const possible=/^[a-zçğıöşü]+$/i.test(key)
    ?dictionary.filter(word=>word!==key&&word.length===key.length&&[...word].every((char,i)=>related(key[i],char)))
    :[];
  return [...new Set([...learned,...possible])].slice(0,5);
}
