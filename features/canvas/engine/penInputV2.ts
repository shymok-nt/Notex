import {normalizeSample, type InputSample} from './penEngineV2';

/** Browser Pointer Events adapter for the Tauri/WebView2 drawing surface.
 * The caller must map client coordinates into page coordinates before persisting.
 * Predicted events are returned separately and must never be committed.
 */
export type PointerLike = {
  clientX:number;clientY:number;pressure:number;tiltX?:number;tiltY?:number;
  twist?:number;timeStamp:number;pointerType:string;buttons:number;
};
export type PointerBatch={real:InputSample[];predicted:InputSample[]};
const convert=(event:PointerLike,map:(x:number,y:number)=>[number,number]):InputSample=>{
  const [x,y]=map(event.clientX,event.clientY);
  return normalizeSample({x,y,pressure:event.pressure,tiltX:event.tiltX??0,
    tiltY:event.tiltY??0,twist:event.twist??0,t:event.timeStamp,
    pointerType:event.pointerType==='pen'?'pen':event.pointerType==='touch'?'touch':event.pointerType==='mouse'?'mouse':'unknown',
    buttons:event.buttons});
};
export function browserPointerBatch(event:PointerLike & {
  getCoalescedEvents?:()=>PointerLike[];getPredictedEvents?:()=>PointerLike[];
},map:(x:number,y:number)=>[number,number]):PointerBatch {
  const coalesced=event.getCoalescedEvents?.()??[];
  const real=(coalesced.length?coalesced:[event]).map(e=>convert(e,map));
  const predicted=(event.getPredictedEvents?.()??[]).map(e=>convert(e,map));
  return {real,predicted};
}
export function nativeStylusSample(
  x:number,y:number,time:number,
  stylusData?:{pressure?:number;tiltX?:number;tiltY?:number;azimuthAngle?:number},
):InputSample {
  return normalizeSample({x,y,t:time,pressure:stylusData?.pressure??.5,
    tiltX:stylusData?.tiltX??0,tiltY:stylusData?.tiltY??0,
    twist:stylusData?.azimuthAngle===undefined?0:stylusData.azimuthAngle*180/Math.PI,
    pointerType:stylusData?'pen':'touch',buttons:0});
}
export type PointerPolicy={stylusOnly:boolean;fingerDraw:boolean;palmRejection:boolean;penProximityUntil:number};
export function canStartDrawing(kind:InputSample['pointerType'],now:number,policy:PointerPolicy):boolean{
  if(kind==='pen')return true;
  if(policy.stylusOnly)return false;
  if(kind==='touch'&&(!policy.fingerDraw||(policy.palmRejection&&now<policy.penProximityUntil)))return false;
  return true;
}
export function temporaryTool(buttons:number,sideButton:'eraser'|'lasso'|'hand'|'none'='eraser'){
  if((buttons&32)!==0)return 'eraser';
  if((buttons&2)!==0)return sideButton;
  return 'none';
}
