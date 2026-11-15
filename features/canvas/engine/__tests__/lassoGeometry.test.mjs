import test from 'node:test';
import assert from 'node:assert/strict';
import {lassoSelect,lassoPathLength,pointInLasso,LASSO_STROKE_INSIDE_RATIO} from '../lassoGeometry.ts';

const polygon=[0,0,100,0,100,100,0,100];
const stroke=(id,points,width=2)=>({id,type:'stroke',z:0,createdAt:'',tool:'pen',color:'#000',width,opacity:1,points,bbox:[Math.min(...points.filter((_,i)=>i%3===0)),Math.min(...points.filter((_,i)=>i%3===1)),Math.max(...points.filter((_,i)=>i%3===0)),Math.max(...points.filter((_,i)=>i%3===1))]});
const text=(id,x,y,w,h)=>({id,type:'text',z:1,createdAt:'',x,y,w,text:'Note',fontSize:18,color:'#000',bold:false,align:'left',bbox:[x,y,x+w,y+h]});
test('threshold is configurable and strict majority',()=>assert.equal(LASSO_STROKE_INSIDE_RATIO,0.5));
test('selects strokes with majority of their path inside, not just a boundary crossing',()=>{
 const mostlyInside=stroke('inside',[-20,50,0.5,60,50,0.5]);
 const mostlyOutside=stroke('outside',[-200,50,0.5,30,50,0.5]);
 assert.deepEqual(lassoSelect([mostlyInside,mostlyOutside],polygon),['inside']);
});
test('distance-based sampling is not biased by many closely spaced points',()=>{
 const points=[-50,50,0.5,0,50,0.5,1,50,0.5,2,50,0.5,3,50,0.5,4,50,0.5,5,50,0.5,6,50,0.5,7,50,0.5,8,50,0.5,9,50,0.5];
 assert.deepEqual(lassoSelect([stroke('unequal',points)],polygon),[]);
});
test('text center or majority of area must be inside',()=>{
 assert.deepEqual(lassoSelect([text('center',90,40,30,20),text('edge',96,20,40,20),text('inside',10,10,20,20)],polygon),['center','inside']);
});
test('locked elements and invalid polygons are ignored',()=>{
 assert.deepEqual(lassoSelect([{...stroke('locked',[10,10,0.5,20,20,0.5]),locked:true}],polygon),[]);
 assert.deepEqual(lassoSelect([text('t',10,10,20,20)],[0,0,10,NaN,0,10]),[]);
 assert.deepEqual(lassoSelect([text('t',10,10,20,20)],[0,0,10,0]),[]);
});
test('self-crossing polygon uses even-odd containment',()=>{
 const bowTie=[0,0,10,10,0,10,10,0];
 assert.equal(pointInLasso(bowTie,[5,2]),pointInLasso(bowTie,[5,2]));
});
test('path length is measured in page coordinates',()=>assert.equal(lassoPathLength([[0,0],[3,4],[6,4]]),8));
