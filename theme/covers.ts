export const coverPalette = [
 {name:'Lacivert',color:'#1B1B2F'},{name:'Mavi',color:'#3347D9'},{name:'Turkuaz',color:'#1C9A8E'},
 {name:'Yeşil',color:'#3E8E5A'},{name:'Sarı',color:'#F2B632'},{name:'Turuncu',color:'#F28C38'},
 {name:'Coral',color:'#FF6B5A'},{name:'Pembe',color:'#E58FB0'},{name:'Mor',color:'#7B5CD6'},
 {name:'Gri',color:'#6B6A78'},{name:'Krem',color:'#E9DFC9'},{name:'Siyah',color:'#111111'}
] as const;
export const defaultCoverColor = '#1B1B2F';
export const specialCoverCollection=[
 {id:'aurora',label:'Aurora',color:'#C9B8EA'},
 {id:'art-deco-emerald',label:'Art Deco Zümrüt',color:'#0F3D3A'},
 {id:'y2k-holographic',label:'Y2K Holografik',color:'#C9D5F4'},
 {id:'lofi-sunset',label:'Lo-fi Günbatımı',color:'#382655'}
] as const;
export type SpecialCoverId=typeof specialCoverCollection[number]['id'];
export function getSpecialCover(id:string|null|undefined){return specialCoverCollection.find(item=>item.id===id)??null}
export const premiumCoverCollections = [
 {style:'classic',label:'Classic',variants:[{id:'classic-sand',label:'Kum',color:'#D8CBB6',ink:'#54483B'},{id:'classic-sage',label:'Adaçayı',color:'#A8AD99',ink:'#354033'},{id:'classic-espresso',label:'Espresso',color:'#493B35',ink:'#E6D4BD'}]},
 {style:'modern',label:'Modern',variants:[{id:'modern-stone',label:'Taş',color:'#B8B7B0',ink:'#3D3D3B'},{id:'modern-ink',label:'Mürekkep',color:'#303A43',ink:'#EDE6DA'},{id:'modern-clay',label:'Kil',color:'#C2A899',ink:'#463932'}]},
 {style:'editorial',label:'Editorial',variants:[{id:'editorial-ivory',label:'Fildişi',color:'#E8E1D4',ink:'#3B3935'},{id:'editorial-ink',label:'Mürekkep',color:'#303A43',ink:'#EDE6DA'},{id:'editorial-clay',label:'Kil',color:'#C2A899',ink:'#463932'}]},
 {style:'abstract',label:'Abstract',variants:[{id:'abstract-blush',label:'Pudra',color:'#E7CFCA',ink:'#775E60'},{id:'abstract-mist',label:'Sis',color:'#C5D3D2',ink:'#506A6B'},{id:'abstract-oat',label:'Yulaf',color:'#DDD1BA',ink:'#72634B'}]}
] as const;
export type PremiumCoverStyle=typeof premiumCoverCollections[number]['style'];
const legacyCoverCollections=[
 {style:'linen',variants:[{id:'linen-sand',color:'#D8CBB6',ink:'#54483B'},{id:'linen-sage',color:'#A8AD99',ink:'#354033'},{id:'linen-stone',color:'#B8B7B0',ink:'#3D3D3B'}]},
 {style:'leather',variants:[{id:'leather-espresso',color:'#493B35',ink:'#E6D4BD'},{id:'leather-oxblood',color:'#673F42',ink:'#F1DBCF'},{id:'leather-tan',color:'#9B7255',ink:'#F5E7D5'}]}
] as const;
export type LegacyCoverStyle=typeof legacyCoverCollections[number]['style'];
export function getPremiumCover(id:string|null|undefined){for(const collection of [...premiumCoverCollections,...legacyCoverCollections]){const variant=collection.variants.find(item=>item.id===id);if(variant)return {style:collection.style,...variant}}return null}
export function darken(hex:string,amount=0.2){const h=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return '#151525';const c=[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*(1-amount)));return '#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');}
export function isLightCover(hex:string){const h=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return false;const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return (r*299+g*587+b*114)/1000>170;}
