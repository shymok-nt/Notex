export const coverPalette = [
 {name:'Lacivert',color:'#1B1B2F'},{name:'Mavi',color:'#3347D9'},{name:'Turkuaz',color:'#1C9A8E'},
 {name:'Yeşil',color:'#3E8E5A'},{name:'Sarı',color:'#F2B632'},{name:'Turuncu',color:'#F28C38'},
 {name:'Coral',color:'#FF6B5A'},{name:'Pembe',color:'#E58FB0'},{name:'Mor',color:'#7B5CD6'},
 {name:'Gri',color:'#6B6A78'},{name:'Krem',color:'#E9DFC9'},{name:'Siyah',color:'#111111'}
] as const;
export const defaultCoverColor = '#1B1B2F';
export function darken(hex:string,amount=0.2){const h=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return '#151525';const c=[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*(1-amount)));return '#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');}
export function isLightCover(hex:string){const h=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return false;const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return (r*299+g*587+b*114)/1000>170;}
