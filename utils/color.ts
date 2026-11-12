/** Hex color helpers used by notebook covers. */
function rgb(hex:string):[number,number,number]{
 const h=hex.replace('#','');
 if(!/^[0-9a-f]{6}$/i.test(h))return [27,27,47];
 return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)) as [number,number,number];
}
function hex(values:number[]){return '#'+values.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join('').toUpperCase();}
export function darken(color:string,amount:number){return hex(rgb(color).map(v=>v*(1-amount)));}
export function lighten(color:string,amount:number){return hex(rgb(color).map(v=>v+(255-v)*amount));}
export function isLightCover(color:string){const [r,g,b]=rgb(color).map(v=>{const s=v/255;return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b>0.4;}
