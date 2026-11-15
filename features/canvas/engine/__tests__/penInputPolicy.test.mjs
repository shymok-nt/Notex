import test from 'node:test';
import assert from 'node:assert/strict';
import {makePenProximity,observePenPointer,penIsNear,shouldBlockDrawing,temporaryTool} from '../penInputPolicy.ts';
const policy={stylusOnly:false,fingerDraw:true,palmRejection:true,palmDelayMs:350,buttonAction:'eraser',eraserTipEnabled:true};
const pen=(timeStamp,buttons=1,button=0)=>({pointerType:'pen',timeStamp,buttons,button,pressure:0.5});
const touch=timeStamp=>({pointerType:'touch',timeStamp,buttons:1,button:0,pressure:0.5});
test('pen hover and down suppress touch, delayed recovery restores it',()=>{
 const state=makePenProximity();
 observePenPointer(state,4,pen(100,0),'move');
 assert.equal(shouldBlockDrawing(touch(150),policy,state),true);
 observePenPointer(state,4,pen(160),'down');
 assert.equal(penIsNear(state,10000),true);
 observePenPointer(state,4,pen(200),'up');
 assert.equal(shouldBlockDrawing(touch(400),policy,state),true);
 assert.equal(shouldBlockDrawing(touch(551),policy,state),false);
});
test('stylus only blocks mouse and touch but not pen',()=>{
 const state=makePenProximity(),strict={...policy,stylusOnly:true};
 assert.equal(shouldBlockDrawing(touch(100),strict,state),true);
 assert.equal(shouldBlockDrawing({...touch(100),pointerType:'mouse'},strict,state),true);
 assert.equal(shouldBlockDrawing(pen(100),strict,state),false);
});
test('eraser tip overrides barrel button and button action is configurable',()=>{
 assert.equal(temporaryTool(pen(1,32,5),policy),'eraser');
 assert.equal(temporaryTool(pen(1,2,2),policy),'eraser');
 assert.equal(temporaryTool(pen(1,2,2),{...policy,buttonAction:'select'}),'select');
 assert.equal(temporaryTool(pen(1,2,2),{...policy,buttonAction:'none'}),null);
});
