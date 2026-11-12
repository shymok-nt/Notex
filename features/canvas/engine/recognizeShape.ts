// Hand-drawn line, rectangle, ellipse and triangle recognition.
// Pure TypeScript; coordinates are in canvas/page units.
export type Sample = readonly number[]; // [x, y, pressure?]
export type Recognized =
  | {kind:'line';x:number;y:number;w:number;h:number}
  | {kind:'rect'|'ellipse';x:number;y:number;w:number;h:number}
  | {kind:'polygon';x:number;y:number;w:number;h:number;points:number[]};

const dist=(a:Sample,b:Sample)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function segDist(p:Sample,a:Sample,b:Sample){
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}

function rdp(pts:Sample[],eps:number):Sample[]{
 if(pts.length<3)return pts;
 let best=0,idx=0;
 for(let i=1;i<pts.length-1;i++){
  const d=segDist(pts[i],pts[0],pts[pts.length-1]);
  if(d>best){best=d;idx=i}
 }
 if(best<=eps)return [pts[0],pts[pts.length-1]];
 return [...rdp(pts.slice(0,idx+1),eps).slice(0,-1),...rdp(pts.slice(idx),eps)];
}

// Uniform spacing prevents drawing speed from biasing shape scores.
function resample(pts:Sample[],step:number):Sample[]{
 const out:Sample[]=[pts[0]];
 let carry=0;
 for(let i=1;i<pts.length;i++){
  let a=out[out.length-1];
  const b=pts[i];
  let d=dist(a,b);
  while(carry+d>=step&&d>0){
   const t=(step-carry)/d;
   const n:Sample=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   out.push(n);a=n;d=dist(a,b);carry=0;
  }
  carry+=d;
 }
 if(dist(out[out.length-1],pts[pts.length-1])>step*0.3)out.push(pts[pts.length-1]);
 return out;
}

function polyError(pts:Sample[],poly:Sample[]):number{
 let sum=0;
 for(const p of pts){
  let d=Infinity;
  for(let i=0;i<poly.length;i++)d=Math.min(d,segDist(p,poly[i],poly[(i+1)%poly.length]));
  sum+=d;
 }
 return sum/pts.length;
}

// A closed RDP contour must start at a real corner, not at an arbitrary pen-down point.
// Otherwise a square can appear to have five corners and lose to the ellipse score.
function rectangleFit(pts:Sample[],diag:number):number{
 const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length;
 const cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
 let anchor=0,maxRadius=-1;
 for(let i=0;i<pts.length;i++){
  const radius=Math.hypot(pts[i][0]-cx,pts[i][1]-cy);
  if(radius>maxRadius){maxRadius=radius;anchor=i}
 }
 const loop=[...pts.slice(anchor),...pts.slice(0,anchor),pts[anchor]];
 let best=Infinity;
 for(let k=0.035;k<=0.125;k+=0.01){
  const corners=rdp(loop,k*diag).slice(0,-1);
  if(corners.length!==4)continue;
  let valid=true;
  for(let i=0;i<4;i++){
   const a=corners[(i+3)%4],b=corners[i],c=corners[(i+1)%4];
   const ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1];
   const len1=Math.hypot(ux,uy),len2=Math.hypot(vx,vy);
   if(Math.min(len1,len2)<diag*0.16||Math.abs((ux*vx+uy*vy)/(len1*len2))>0.48){
    valid=false;break;
   }
  }
  if(valid)best=Math.min(best,polyError(pts,corners));
 }
 return best;
}

// Snap almost-square and almost-circular hand drawings to exact geometry.
// Preserve deliberately wide or tall rectangles and ellipses.
function regularize(kind:'rect'|'ellipse',x:number,y:number,w:number,h:number):Recognized{
 const ratio=Math.min(w,h)/Math.max(w,h);
 if(ratio<0.76)return {kind,x,y,w,h};
 const side=(w+h)/2;
 return {kind,x:x+(w-side)/2,y:y+(h-side)/2,w:side,h:side};
}
export function recognizeShape(raw:Sample[]):Recognized|null{
 if(raw.length<4)return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of raw){
  minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);
  maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);
 }
 const w=maxX-minX,h=maxY-minY,diag=Math.hypot(w,h);
 if(diag<40)return null;
 const pts=resample(raw,Math.max(2,diag/80));
 if(pts.length<6)return null;
 const first=pts[0],last=pts[pts.length-1];
 const gap=dist(first,last);
 const closed=gap<0.3*diag;
 if(!closed){
  let dev=0;
  for(const p of pts)dev=Math.max(dev,segDist(p,first,last));
  if(dev<0.08*gap){
   let x1=last[0],y1=last[1];
   const ang=Math.atan2(y1-first[1],x1-first[0])*180/Math.PI;
   const a=((ang%180)+180)%180;
   if(a<6||a>174)y1=first[1];
   else if(Math.abs(a-90)<6)x1=first[0];
   return {kind:'line',x:first[0],y:first[1],w:x1-first[0],h:y1-first[1]};
  }
  return null;
 }
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,rx=w/2,ry=h/2;
 if(rx<8||ry<8)return null;
 let ell=0;
 for(const p of pts)ell+=Math.abs(Math.hypot((p[0]-cx)/rx,(p[1]-cy)/ry)-1);
 ell=ell/pts.length*((rx+ry)/2);
 const rectPoly:Sample[]=[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]];
 const rec=polyError(pts,rectPoly);
 const cornerRec=rectangleFit(pts,diag);

 let tri=Infinity,triPoly:Sample[]|null=null;
 const loop=[...pts,pts[0]];
 for(let k=0.04;k<=0.4;k+=0.02){
  const s=rdp(loop,k*diag);
  const verts=s.slice(0,-1);
  if(verts.length===3){triPoly=verts;tri=polyError(pts,verts);break}
  if(verts.length<3)break;
 }
 if(triPoly){
  const [a,b,c]=triPoly;
  const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/2;
  if(area<0.12*w*h)tri=Infinity;
 }
 // Strong four-corner evidence takes priority over an ellipse's bbox-based score.
 // Preserve the original candidate competition when the corners are ambiguous.
 if(cornerRec<0.075*diag&&cornerRec<tri*0.9){
  return regularize('rect',minX,minY,w,h);
 }
 const candidates=[
  {kind:'ellipse' as const,e:ell},
  {kind:'rect' as const,e:rec},
  {kind:'tri' as const,e:tri},
 ].sort((a,b)=>a.e-b.e);
 const best=candidates[0];
 if(best.e>0.075*diag)return null;
 if(best.kind==='ellipse')return regularize('ellipse',minX,minY,w,h);
 if(best.kind==='rect')return regularize('rect',minX,minY,w,h);
 const v=triPoly!;
 const px=v.flatMap(p=>[Math.round(p[0]*10)/10,Math.round(p[1]*10)/10]);
 // Rebuild a balanced isosceles triangle from the recognized bounds.
 // Keeping the traced vertices makes supposedly straight edges look skewed.
 const side=Math.max(w,h*2/Math.sqrt(3));
 const height=side*Math.sqrt(3)/2;
 const tcx=(minX+maxX)/2,tcy=(minY+maxY)/2;
 const left=tcx-side/2,top=tcy-height/2;
 return {kind:'polygon',x:left,y:top,w:side,h:height,points:[tcx,top,tcx+side/2,top+height,tcx-side/2,top+height]};
}
