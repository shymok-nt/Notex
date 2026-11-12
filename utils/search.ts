export function normalizeSearch(text:string){return text.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae')}
export function matchesSearch(title:string,query:string){return normalizeSearch(title).includes(normalizeSearch(query.trim()))}
