import test from 'node:test';
import assert from 'node:assert/strict';
import {appendPolylinePoint,centerlinePathString,legacyCenterlinePathString} from '../centerlinePath.ts';

test('raw centerline uses only moveTo/lineTo commands and preserves each sampled point',()=>{
 const samples=[[0,0,0.5],[10,0,0.5],[11,1,0.5],[12,0,0.5],[30,4,0.5]];
 const source=structuredClone(samples);
 const path=centerlinePathString(samples);
 assert.equal(path,'M0 0 L10 0 L11 1 L12 0 L30 4');
 assert.doesNotMatch(path,/[CQ]/);
 assert.deepEqual(samples,source);
});

test('incremental live path is identical to the finalized path without a release jump',()=>{
 const samples=[[2,5,0.5],[2.3,5.4,0.5],[10,6,0.5],[11,19,0.5],[48,23,0.5]];
 let live=`M${Math.round(samples[0][0]*10)/10} ${Math.round(samples[0][1]*10)/10}`;
 for(const sample of samples.slice(1))live=appendPolylinePoint(live,sample);
 assert.equal(live,centerlinePathString(samples));
});

test('single-point, short and rapid long strokes cannot create spline overshoot',()=>{
 const cases=[[[4,8,0.5]],[[4,8,0.5],[4.1,8.2,0.5]],[[0,0,0.5],[1,0,0.5],[40,0,0.5],[41,0,0.5]]];
 for(const samples of cases){
  const path=centerlinePathString(samples);
  assert.ok(path.startsWith('M'));
  assert.doesNotMatch(path,/[CQ]/);
  for(const [x,y] of samples)assert.ok(path.includes(`${Math.round(x*10)/10} ${Math.round(y*10)/10}`));
 }
});

test('legacy centerline data keeps its previous renderer while new raw paths stay linear',()=>{
 const points=[[0,0,0.5],[10,4,0.5],[20,18,0.5],[30,20,0.5]];
 assert.match(legacyCenterlinePathString(points),/C/);
 assert.doesNotMatch(centerlinePathString(points),/[CQ]/);
});

test('rapid consecutive strokes begin at their own first point',()=>{
 const oldStroke=centerlinePathString([[12,20,0.5],[18,24,0.5]]);
 const newStroke=centerlinePathString([[220,160,0.5]]);
 const continued=appendPolylinePoint(newStroke,[224,166,0.5]);
 assert.match(oldStroke,/^M12 20/);
 assert.match(continued,/^M220 160 L224 166$/);
 assert.doesNotMatch(continued,/12 20|18 24/);
});
