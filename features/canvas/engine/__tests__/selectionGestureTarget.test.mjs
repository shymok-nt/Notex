import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldGrabSelectionCorner} from '../selectionGestureTarget.ts';

test('a narrow lasso selection remains draggable at its center',()=>{
 const center=[100,100],corner=[103,102],radius=22;
 assert.equal(shouldGrabSelectionCorner(center,corner,center,radius),false);
 assert.equal(shouldGrabSelectionCorner([103,102],corner,center,radius),false);
});

test('corner handle remains available away from the selection center',()=>{
 const center=[100,100],corner=[150,150],radius=22;
 assert.equal(shouldGrabSelectionCorner([150,150],corner,center,radius),true);
 assert.equal(shouldGrabSelectionCorner([120,120],corner,center,radius),false);
});
