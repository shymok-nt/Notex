import test from 'node:test';
import assert from 'node:assert/strict';
import {lassoSelect,lassoPathLength,pointInLasso} from '../lassoGeometry.ts';

const polygon=[0,0,100,0,100,100,0,100];
const stroke=(id,points,width=2)=>({id,type:'stroke',z:0,createdAt:'',tool:'pen',color:'#000',width,opacity:1,points,bbox:[Math.min(...points.filter((_,i)=>i%3===0)),Math.min(...points.filter((_,i)=>i%3===1)),Math.max(...points.filter((_,i)=>i%3===0)),Math.max(...points.filter((_,i)=>i%3===1))]});
const shape=(id,kind,x,y,w,h,extra={})=>({id,type:'shape',z:0,createdAt:'',kind,params:{x,y,w,h,rotation:0,...extra},stroke:{color:'#000',width:2,opacity:1},fill:null,bbox:[x,y,x+w,y+h]});

test('lasso selects a stroke crossing its boundary even when both endpoints are outside',()=>{
 assert.deepEqual(lassoSelect([stroke('crossing',[[-10,50,0.5],[110,50,0.5]].flat())],polygon),['crossing']);
});

test('bbox overlap alone does not select unrelated stroke geometry',()=>{
 const line=stroke('unrelated',[80,10,0.5,10,80,0.5]);
 assert.deepEqual(lassoSelect([line],[0,0,40,0,40,40,0,40]),[]);
});

test('visible width of a thick stroke participates in the hit test',()=>{
 assert.deepEqual(lassoSelect([stroke('thick',[105,25,0.5,105,75,0.5],12)],polygon),['thick']);
});

test('lasso includes partially intersected shapes and text bounds',()=>{
 const rect=shape('rect','rect',95,30,40,30);
 const text={id:'text',type:'text',z:1,createdAt:'',x:96,y:20,w:40,text:'Note',fontSize:18,color:'#000',bold:false,align:'left',bbox:[96,20,136,40]};
 assert.deepEqual(lassoSelect([rect,text],polygon),['rect','text']);
});

test('ellipse and stored polygon geometry are tested rather than only their boxes',()=>{
 const ellipse=shape('ellipse','ellipse',30,30,40,40);
 const triangle=shape('triangle','polygon',130,30,40,40,{points:[150,30,170,70,130,70]});
 assert.deepEqual(lassoSelect([ellipse,triangle],[29,48,31,48,31,52,29,52]),['ellipse']);
 assert.deepEqual(lassoSelect([triangle],[129,29,136,29,136,35,129,35]),[]);
});

test('a lasso fully inside hollow shape bounds does not select it, while filled geometry does',()=>{
 const hollow=shape('hollow','rect',0,0,100,100);
 const filled={...hollow,id:'filled',fill:{color:'#000',opacity:0.2}};
 const inner=[40,40,60,40,60,60,40,60];
 assert.deepEqual(lassoSelect([hollow],inner),[]);
 assert.deepEqual(lassoSelect([filled],inner),['filled']);
});

test('self-crossing lasso follows deterministic even-odd point containment',()=>{
 const bowTie=[0,0,10,10,0,10,10,0];
 assert.equal(pointInLasso(bowTie,[5,2]),pointInLasso(bowTie,[5,2]));
 assert.deepEqual(lassoSelect([stroke('upper',[4,2,0.5,6,2,0.5])],bowTie),['upper']);
});

test('invalid polygons are ignored and movement length is available for tap thresholding',()=>{
 assert.deepEqual(lassoSelect([stroke('s',[5,5,0.5,8,8,0.5])],[0,0,10,NaN,0,10]),[]);
 assert.deepEqual(lassoSelect([stroke('s',[5,5,0.5,8,8,0.5])],[0,0,10,0]),[]);
 assert.equal(lassoPathLength([[0,0],[3,4],[6,4]]),8);
});
