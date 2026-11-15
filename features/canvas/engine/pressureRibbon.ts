/** Deterministic pressure ribbon shared by the UI worklet and persisted renderer.
 * No Skia or JS runtime dependencies; identical samples yield identical SVG.
 */
export function ribbonPath(points: readonly (readonly [number,number,number])[],size:number,minRatio:number,maxRatio:number,curve:'soft'|'normal'|'hard'|'linear'='normal'):string{
 'worklet';
 if(!points.length)return '';
 const fmt=(n:number)=>Number.isFinite(n)?Math.round(n*1000)/1000:0;
 const radius=(p:number)=>{
  'worklet';
  const normalized=Math.max(0,Math.min(1,p));
  const adjusted=curve==='soft'?Math.pow(normalized,.6):curve==='hard'?Math.pow(normalized,1.8):normalized;
  return Math.max(.05,size*(minRatio+(maxRatio-minRatio)*adjusted)/2);
 };
 if(points.length===1){
  const [x,y,p]=points[0],r=radius(p);
  return `M${fmt(x-r)} ${fmt(y)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(x+r)} ${fmt(y)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(x-r)} ${fmt(y)} Z`;
 }
 const left:string[]=[],right:string[]=[];
 for(let i=0;i<points.length;i++){
  const [x,y,p]=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
  const dx=next[0]-prev[0],dy=next[1]-prev[1],length=Math.hypot(dx,dy)||1;
  const nx=-dy/length,ny=dx/length,r=radius(p);
  left.push(`${fmt(x+nx*r)} ${fmt(y+ny*r)}`);
  right.push(`${fmt(x-nx*r)} ${fmt(y-ny*r)}`);
 }
 return 'M'+left.join(' L')+' L'+right.reverse().join(' L')+' Z';
}
