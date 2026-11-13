import type {Element,ShapeElement,StrokeElement,Bounds} from '@/features/canvas/types';

type XY=readonly [number,number];
type LassoEdge={a:XY;b:XY;bounds:Bounds};
const EPSILON=1e-7;
const pointAt=(flat:readonly number[],index:number):XY=>[flat[index*2],flat[index*2+1]];
const distance=(a:XY,b:XY)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function pointInLasso(polygon:readonly number[],point:XY):boolean{
 if(polygon.length<6||polygon.length%2!==0)return false;
 let inside=false;
 for(let i=0,j=polygon.length-2;i<polygon.length;j=i,i+=2){
  const xi=polygon[i],yi=polygon[i+1],xj=polygon[j],yj=polygon[j+1];
  if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}

function pointSegmentDistance(p:XY,a:XY,b:XY):number{
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}
function orientation(a:XY,b:XY,c:XY):number{return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function onSegment(a:XY,b:XY,p:XY):boolean{return p[0]>=Math.min(a[0],b[0])-EPSILON&&p[0]<=Math.max(a[0],b[0])+EPSILON&&p[1]>=Math.min(a[1],b[1])-EPSILON&&p[1]<=Math.max(a[1],b[1])+EPSILON}
function segmentsIntersect(a:XY,b:XY,c:XY,d:XY):boolean{
 const abC=orientation(a,b,c),abD=orientation(a,b,d),cdA=orientation(c,d,a),cdB=orientation(c,d,b);
 if(((abC>EPSILON&&abD<-EPSILON)||(abC<-EPSILON&&abD>EPSILON))&&((cdA>EPSILON&&cdB<-EPSILON)||(cdA<-EPSILON&&cdB>EPSILON)))return true;
 return Math.abs(abC)<=EPSILON&&onSegment(a,b,c)||Math.abs(abD)<=EPSILON&&onSegment(a,b,d)||Math.abs(cdA)<=EPSILON&&onSegment(c,d,a)||Math.abs(cdB)<=EPSILON&&onSegment(c,d,b);
}
function segmentDistance(a:XY,b:XY,c:XY,d:XY):number{
 if(segmentsIntersect(a,b,c,d))return 0;
 return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function lassoBounds(polygon:readonly number[]):Bounds{
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(let i=0;i<polygon.length;i+=2){left=Math.min(left,polygon[i]);top=Math.min(top,polygon[i+1]);right=Math.max(right,polygon[i]);bottom=Math.max(bottom,polygon[i+1]);}
 return [left,top,right,bottom];
}
function boundsOverlap(a:Bounds,b:Bounds,padding=0):boolean{return a[0]-padding<=b[2]&&a[2]+padding>=b[0]&&a[1]-padding<=b[3]&&a[3]+padding>=b[1]}
function makeLassoEdges(polygon:readonly number[]):LassoEdge[]{
 const edges:LassoEdge[]=[];
 for(let i=0;i<polygon.length;i+=2){const a=pointAt(polygon,i/2),b=pointAt(polygon,((i/2)+1)%(polygon.length/2));edges.push({a,b,bounds:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]});}
 return edges;
}
function segmentHitsLasso(a:XY,b:XY,edges:readonly LassoEdge[],radius:number):boolean{
 const bounds:Bounds=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
 for(const edge of edges)if(boundsOverlap(bounds,edge.bounds,radius)&&segmentDistance(a,b,edge.a,edge.b)<=radius)return true;
 return false;
}
function polylineHitsLasso(points:readonly number[],polygon:readonly number[],edges:readonly LassoEdge[],radius:number):boolean{
 if(points.length<2||points.length%2!==0)return false;
 if(pointInLasso(polygon,[points[0],points[1]]))return true;
 if(points.length===2){
  const p:[number,number]=[points[0],points[1]];
  for(const edge of edges)if(pointSegmentDistance(p,edge.a,edge.b)<=radius)return true;
  return false;
 }
 for(let i=0;i<points.length-2;i+=2)if(segmentHitsLasso([points[i],points[i+1]],[points[i+2],points[i+3]],edges,radius))return true;
 return false;
}
function strokePoints(stroke:StrokeElement):number[]{const points:number[]=[];for(let i=0;i+1<stroke.points.length;i+=3)points.push(stroke.points[i],stroke.points[i+1]);return points}
function shapePoints(shape:ShapeElement):{points:number[];closed:boolean}{
 const {x,y,w,h,rotation,points:stored}=shape.params;
 let points:number[];
 if(shape.kind==='polygon'&&stored&&stored.length>=6)points=[...stored];
 else if(shape.kind==='line')points=[x,y,x+w,y+h];
 else if(shape.kind==='arrow'){
  const angle=Math.atan2(h,w),head=Math.max(14,shape.stroke.width*4);
  points=[x,y,x+w,y+h,x+w-head*Math.cos(angle-0.5),y+h-head*Math.sin(angle-0.5),x+w,y+h,x+w-head*Math.cos(angle+0.5),y+h-head*Math.sin(angle+0.5)];
 }else if(shape.kind==='ellipse'){
  const rx=Math.abs(w)/2,ry=Math.abs(h)/2,cx=x+w/2,cy=y+h/2;points=[];
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;points.push(cx+rx*Math.cos(a),cy+ry*Math.sin(a));}
 }else if(shape.kind==='triangle')points=[x+w/2,y,x+w,y+h,x,y+h];
 else points=[x,y,x+w,y,x+w,y+h,x,y+h];
 if(rotation){const cx=x+w/2,cy=y+h/2,cos=Math.cos(rotation),sin=Math.sin(rotation);for(let i=0;i<points.length;i+=2){const dx=points[i]-cx,dy=points[i+1]-cy;points[i]=cx+dx*cos-dy*sin;points[i+1]=cy+dx*sin+dy*cos;}}
 return {points,closed:shape.kind!=='line'&&shape.kind!=='arrow'};
}
function polygonContainsRect(polygon:readonly number[],edges:readonly LassoEdge[],bounds:Bounds):boolean{
 const corners:XY[]=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]];
 const polygonInsideRect=polygon.some((_,index)=>index%2===0&&polygon[index]>=bounds[0]&&polygon[index]<=bounds[2]&&polygon[index+1]>=bounds[1]&&polygon[index+1]<=bounds[3]);
 return polygonInsideRect||corners.some(p=>pointInLasso(polygon,p))||pointInLasso(polygon,[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2])||rectEdgesHit(edges,bounds);
}
function rectEdgesHit(edges:readonly LassoEdge[],bounds:Bounds):boolean{
 const corners:XY[]=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]];
 for(let i=0;i<4;i++)if(segmentHitsLasso(corners[i],corners[(i+1)%4],edges,0))return true;
 return false;
}
function elementHitsLasso(element:Element,polygon:readonly number[],edges:readonly LassoEdge[],polyBounds:Bounds):boolean{
 if(!Array.isArray(element.bbox)||element.bbox.length!==4||!element.bbox.every(Number.isFinite)||!boundsOverlap(polyBounds,element.bbox,element.type==='stroke'?Math.max(0,element.width/2):element.type==='shape'?Math.max(0,element.stroke.width/2):0))return false;
 if(element.type==='stroke')return polylineHitsLasso(strokePoints(element),polygon,edges,Math.max(0,element.width/2));
 if(element.type==='text')return polygonContainsRect(polygon,edges,element.bbox);
 if(element.type==='shape'){
  const {points,closed}=shapePoints(element),radius=Math.max(0,element.stroke.width/2);
  const geometry=closed&&points.length>=4?[...points,points[0],points[1]]:points;
  const filledInteriorHit=closed&&!!element.fill&&(points.some((_,i)=>i%2===0&&pointInLasso(polygon,[points[i],points[i+1]]))||polygon.some((_,i)=>i%2===0&&pointInLasso(points,[polygon[i],polygon[i+1]])));
  return polylineHitsLasso(geometry,polygon,edges,radius)||filledInteriorHit;
 }
 return false;
}

/**
 * Select whole elements whose visible geometry intersects a freehand polygon.
 * Even-odd ray casting makes self-crossing lassos deterministic.
 */
export function lassoSelect(elements:readonly Element[],polygon:readonly number[]):string[]{
 if(polygon.length<6||polygon.length%2!==0||polygon.some(value=>!Number.isFinite(value)))return [];
 const bounds=lassoBounds(polygon);
 if(!bounds.every(Number.isFinite))return [];
 const edges=makeLassoEdges(polygon);
 const out:string[]=[];
 for(const element of elements)if(elementHitsLasso(element,polygon,edges,bounds))out.push(element.id);
 return out;
}

/** Page-coordinate path length; callers pass a zoom-adjusted minimum. */
export function lassoPathLength(points:readonly (readonly number[])[]):number{
 'worklet';
 let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);return total;
}
