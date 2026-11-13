import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSelectionClipboard,readSelectionClipboard,writeSelectionClipboard} from '../selectionClipboard.ts';

test('clipboard keeps a deep in-memory copy independent from source elements',()=>{
 const source=[{id:'s',type:'stroke',points:[1,2,0.5],bbox:[1,2,1,2],tool:'pen',color:'#000',width:2,opacity:1,z:0,createdAt:''}];
 writeSelectionClipboard(source);
 source[0].points[0]=99;
 const copied=readSelectionClipboard();
 assert.equal(hasSelectionClipboard(),true);
 assert.equal(copied[0].points[0],1);
 copied[0].points[1]=77;
 assert.equal(readSelectionClipboard()[0].points[1],2);
});
