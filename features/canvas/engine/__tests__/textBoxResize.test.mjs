import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeTextBox } from '../textBoxResize.ts';

const base={
 x:100,y:200,startWidth:300,startHeightPx:100,scale:2,
 pageWidth:1000,pageHeight:1400,minimumEditorHeight:40,contentHeightPx:40,manualMinHeight:null,
};

test('the bottom-right handle resizes width and height independently in all drag directions',()=>{
 assert.deepEqual(resizeTextBox({...base,deltaX:40,deltaY:0}),{width:320,heightPx:100,manualMinHeight:50});
 assert.deepEqual(resizeTextBox({...base,deltaX:-40,deltaY:0}),{width:280,heightPx:100,manualMinHeight:50});
 assert.deepEqual(resizeTextBox({...base,deltaX:0,deltaY:30}),{width:300,heightPx:130,manualMinHeight:65});
 assert.deepEqual(resizeTextBox({...base,deltaX:0,deltaY:-30}),{width:300,heightPx:70,manualMinHeight:35});
});

test('diagonal drags update both dimensions while keeping the top-left origin external and unchanged',()=>{
 assert.deepEqual(resizeTextBox({...base,deltaX:40,deltaY:30}),{width:320,heightPx:130,manualMinHeight:65});
 assert.deepEqual(resizeTextBox({...base,deltaX:-40,deltaY:-30}),{width:280,heightPx:70,manualMinHeight:35});
});

test('content height is a hard minimum and manual height survives horizontal resizing',()=>{
 assert.deepEqual(resizeTextBox({...base,startHeightPx:200,contentHeightPx:90,deltaX:20,deltaY:-150,manualMinHeight:100}),{width:310,heightPx:90,manualMinHeight:null});
 assert.deepEqual(resizeTextBox({...base,deltaX:20,deltaY:0,manualMinHeight:120}),{width:310,heightPx:240,manualMinHeight:120});
});

test('minimum sizes and page edges clamp the live result safely',()=>{
 assert.deepEqual(resizeTextBox({...base,x:950,y:1390,startWidth:80,startHeightPx:20,deltaX:500,deltaY:500}),{width:50,heightPx:20,manualMinHeight:null});
});
