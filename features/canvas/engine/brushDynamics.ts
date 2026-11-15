import type {BrushSnapshot,PressureCurveKind} from '../types';
export const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
export const pressureCurve=(p:number,kind:PressureCurveKind,deadZone=0,maxPressure=1)=>{
 const normalized=clamp01((p-Math.min(0.95,Math.max(0,deadZone)))/Math.max(0.001,maxPressure-deadZone));
 switch(kind){
  case 'soft':return Math.pow(normalized,0.65);
  case 'hard':return Math.pow(normalized,1.65);
  case 'normal':return Math.pow(normalized,0.9);
  default:return normalized;
 }
};
export const defaultBrush=(kind:BrushSnapshot['kind']='fountain'):BrushSnapshot=>({
 kind,size:5,minSizeRatio:kind==='ballpoint'?0.85:0.25,maxSizeRatio:1,
 opacity:kind==='marker'?0.35:1,flow:1,taperStart:kind==='fountain'?8:0,taperEnd:kind==='fountain'?8:0,
 stabilization:25,pressureCurve:'normal',pressureDeadZone:0.03,pressureMax:1,
 pressureWidth:kind!=='marker',pressureOpacity:false,simulatePressure:false,
 tiltSensitivity:kind==='pencil'?0.7:0,cap:kind==='marker'||kind==='calligraphy'?'flat':'round',angle:45
});
export function brushDynamics(pressure:number,brush:BrushSnapshot){
 const mapped=pressureCurve(pressure,brush.pressureCurve,brush.pressureDeadZone,brush.pressureMax);
 const ratio=brush.minSizeRatio+(brush.maxSizeRatio-brush.minSizeRatio)*mapped;
 return {width:brush.size*(brush.pressureWidth?ratio:1),opacity:clamp01(brush.opacity*brush.flow*(brush.pressureOpacity?mapped:1))};
}
/** A speed-adaptive low-pass filter: slow movement is smoothed more, fast movement follows the nib. */
export function stabilizePoint(previous:readonly [number,number],current:readonly [number,number],dtMs:number,strength:number):[number,number]{
 const amount=clamp01(strength/100);
 if(amount===0)return [current[0],current[1]];
 const speed=Math.hypot(current[0]-previous[0],current[1]-previous[1])/Math.max(1,dtMs);
 const smoothing=amount*0.85/(1+speed*0.65);
 return [current[0]*(1-smoothing)+previous[0]*smoothing,current[1]*(1-smoothing)+previous[1]*smoothing];
}
/** Preserve corners and pressure changes while removing near-duplicate straight-line samples. */
export function simplifySamples(points:readonly (readonly [number,number,number])[],distanceTolerance=0.15,pressureTolerance=0.025){
 if(points.length<=2)return points.map(p=>[...p] as [number,number,number]);
 const result:[number,number,number][]=[[...points[0]] as [number,number,number]];
 for(let i=1;i<points.length-1;i++){
  const prev=result[result.length-1],p=points[i],next=points[i+1];
  const dx=next[0]-prev[0],dy=next[1]-prev[1],len2=dx*dx+dy*dy;
  const t=len2>0?Math.max(0,Math.min(1,((p[0]-prev[0])*dx+(p[1]-prev[1])*dy)/len2)):0;
  const distance=Math.hypot(p[0]-prev[0]-t*dx,p[1]-prev[1]-t*dy);
  const pressureDelta=Math.abs(p[2]-(prev[2]+(next[2]-prev[2])*t));
  if(distance>distanceTolerance||pressureDelta>pressureTolerance)result.push([...p] as [number,number,number]);
 }
 result.push([...points[points.length-1]] as [number,number,number]);
 return result;
}
