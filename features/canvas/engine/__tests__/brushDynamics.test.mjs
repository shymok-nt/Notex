import test from 'node:test';
import assert from 'node:assert/strict';
import {pressureCurve,defaultBrush,brushDynamics,stabilizePoint,simplifySamples} from '../brushDynamics.ts';
test('pressure curves preserve endpoints and change width distribution',()=>{
 const p=0.4;
 assert.equal(pressureCurve(0,'linear'),0);
 assert.equal(pressureCurve(1,'linear'),1);
 assert.ok(pressureCurve(p,'soft')>pressureCurve(p,'hard'));
 const brush=defaultBrush('fountain');
 assert.ok(brushDynamics(0.9,brush).width>brushDynamics(0.1,brush).width);
});
test('stabilization zero is raw and high smooths jitter',()=>{
 const prev=[0,0],point=[1,2];
 assert.deepEqual(stabilizePoint(prev,point,8,0),point);
 const smooth=stabilizePoint(prev,point,8,100);
 assert.ok(smooth[1]<2&&smooth[1]>0);
});
test('straight duplicates simplify while pressure bends remain',()=>{
 const points=[[0,0,0.2],[1,0,0.2],[2,0,0.8],[3,0,0.2],[4,0,0.2]];
 const result=simplifySamples(points);
 assert.deepEqual(result[0],points[0]);
 assert.deepEqual(result.at(-1),points.at(-1));
 assert.ok(result.some(p=>p[2]===0.8));
});
test('3000 samples simplify without dropping endpoints',()=>{
 const points=Array.from({length:3000},(_,i)=>[i,0,0.5]);
 const result=simplifySamples(points);
 assert.equal(result.length,2);
 assert.equal(result[1][0],2999);
});
