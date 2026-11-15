import test from 'node:test';
import assert from 'node:assert/strict';
import {isSelectionHandoffCommitted,needsReleasedSelectionHandoff,shouldApplySelectionPreviewTransform,shouldDismissSelectionOnBlankTap,shouldUseCommittedSelectionGeometry} from '../selectionHandoff.ts';

test('final geometry is committed only when page content contains the exact elements',()=>{
 const previous={id:'stroke-1',x:0},moved={id:'stroke-1',x:40};
 assert.equal(isSelectionHandoffCommitted([moved],[previous]),false);
 assert.equal(isSelectionHandoffCommitted([moved],[moved]),true);
});

test('released transform overlay remains until committed page geometry is available',()=>{
 assert.equal(needsReleasedSelectionHandoff(true,false,true,false),true);
 assert.equal(needsReleasedSelectionHandoff(true,false,false,true),true);
 assert.equal(needsReleasedSelectionHandoff(true,true,false,false),false);
 assert.equal(needsReleasedSelectionHandoff(false,false,false,false),false);
});

test('only an empty single-tap decision in select mode dismisses a live selection',()=>{
 assert.equal(shouldDismissSelectionOnBlankTap(true,true,false),true);
 assert.equal(shouldDismissSelectionOnBlankTap(true,true,true),false);
 assert.equal(shouldDismissSelectionOnBlankTap(false,true,false),false);
 assert.equal(shouldDismissSelectionOnBlankTap(true,false,false),false);
});

test('active selection uses final element geometry once the page commit is confirmed',()=>{
 assert.equal(shouldUseCommittedSelectionGeometry(false,true),false);
 assert.equal(shouldUseCommittedSelectionGeometry(true,false),false);
 assert.equal(shouldUseCommittedSelectionGeometry(true,true),true);
});

test('committed geometry accepts every repeated live drag until its next handoff commits',()=>{
 assert.equal(shouldApplySelectionPreviewTransform(true,false,false,3,3),false);
 assert.equal(shouldApplySelectionPreviewTransform(true,true,false,3,3),true);
 assert.equal(shouldApplySelectionPreviewTransform(true,false,true,3,4),true);
 assert.equal(shouldApplySelectionPreviewTransform(true,false,true,4,4),false);
 assert.equal(shouldApplySelectionPreviewTransform(false,false,true,4,4),true);
});

test('hydrated stroke with equal geometry confirms the handoff despite new object identity',()=>{
 const before={id:'s',type:'stroke',points:[0,0,0.5,10,0,0.5],bbox:[0,0,10,0],width:2};
 const after={...before,points:[20,0,0.5,30,0,0.5],bbox:[20,0,30,0]};
 const hydrated=JSON.parse(JSON.stringify(after));
 assert.equal(isSelectionHandoffCommitted([after],[hydrated]),true);
 assert.equal(isSelectionHandoffCommitted([after],[before]),false);
});
test('persisted textBoxes rehydration does not flash old geometry',()=>{
 const moved={id:'t',type:'text',z:1,createdAt:'now',x:80,y:40,w:150,text:'Merhaba',fontSize:20,color:'#000',bold:false,align:'left',bbox:[80,40,230,80]};
 const restored={id:'t',type:'text',z:1,createdAt:'now',x:80,y:40,w:150,text:'Merhaba',fontSize:20,color:'#000',bold:false,italic:false,underline:false,align:'left',fontFamily:'Inter',minHeight:40,bbox:[80,40,230,80]};
 assert.equal(isSelectionHandoffCommitted([moved],[restored]),true);
 assert.equal(isSelectionHandoffCommitted([moved],[{...restored,x:0,bbox:[0,40,150,80]}]),false);
});
