import assert from 'node:assert/strict';
import test from 'node:test';
import {pdfPageLayout} from '../pdfPageLayout.ts';

test('PDF background keeps its aspect ratio in the standard Notex page',()=>{
 const a4=pdfPageLayout(595.28,841.89,1000,1414);
 assert.equal(a4.width,1000);
 assert.ok(Math.abs(a4.width/a4.height-595.28/841.89)<1e-10);
 assert.equal(a4.y,0);
 const landscape=pdfPageLayout(841.89,595.28,1000,1414);
 assert.ok(Math.abs(landscape.width/landscape.height-841.89/595.28)<1e-10);
 assert.ok(landscape.y>0);
 assert.equal(landscape.y+landscape.height/2,707);
});

test('invalid PDF page dimensions are rejected',()=>{
 for(const dimensions of [[0,100,1000,1414],[100,0,1000,1414],[-1,10,1000,1414],[Number.NaN,1,1000,1414],[1,Infinity,1000,1414]])assert.throws(()=>pdfPageLayout(...dimensions));
 assert.throws(()=>pdfPageLayout(1,2_000_000,1000,1414));
});
