/** Device-neutral input samples. Predicted samples must never be persisted. */
export type InputSample={x:number;y:number;pressure:number;tiltX:number;tiltY:number;twist:number;t:number;pointerType:'pen'|'mouse'|'touch';buttons:number};
export type PointerBatch={actual:InputSample[];predicted:InputSample[];coalescedCount:number;pointerId:number;button:number;eraser:boolean;barrelButton:boolean;hover:boolean;altitudeAngle:number|null;azimuthAngle:number|null};
export function fromPointerEvent(event:PointerEvent,rect:DOMRect):InputSample{
 return {x:event.clientX-rect.left,y:event.clientY-rect.top,pressure:Number.isFinite(event.pressure)?event.pressure:0,tiltX:event.tiltX??0,tiltY:event.tiltY??0,twist:event.twist??0,t:event.timeStamp,pointerType:event.pointerType==='pen'?'pen':event.pointerType==='touch'?'touch':'mouse',buttons:event.buttons};
}
export function readPointerBatch(event:PointerEvent,rect:DOMRect):PointerBatch{
 let coalesced:PointerEvent[]=[];
 try{coalesced=event.getCoalescedEvents?.()??[]}catch{}
 const actual=(coalesced.length?coalesced:[event]).map(item=>fromPointerEvent(item,rect));
 let predicted:PointerEvent[]=[];
 try{predicted=event.getPredictedEvents?.()??[]}catch{}
 return {actual,predicted:predicted.map(item=>fromPointerEvent(item,rect)),coalescedCount:coalesced.length,pointerId:event.pointerId,button:event.button,eraser:(event.buttons&32)!==0||event.button===5,barrelButton:(event.buttons&2)!==0||event.button===2,hover:event.pointerType==='pen'&&event.buttons===0&&event.pressure===0,altitudeAngle:typeof event.altitudeAngle==='number'?event.altitudeAngle:null,azimuthAngle:typeof event.azimuthAngle==='number'?event.azimuthAngle:null};
}
export type InputCapabilities={pressure:boolean;tilt:boolean;barrelButton:boolean;eraser:boolean;hz:number;pressureUnavailable:boolean};
export function detectCapabilities(samples:readonly InputSample[],barrelButton:boolean,eraser:boolean):InputCapabilities{
 const pen=samples.filter(s=>s.pointerType==='pen'&&s.buttons!==0&&s.pressure>0);
 const pressures=pen.map(s=>s.pressure);
 const distinct=new Set(pressures.map(p=>Math.round(p*100)/100));
 const pressure=pen.length>=8&&distinct.size>=3&&Math.max(...pressures)-Math.min(...pressures)>0.08;
 const tilt=pen.some(s=>Math.abs(s.tiltX)>1||Math.abs(s.tiltY)>1);
 const sorted=[...samples].sort((a,b)=>a.t-b.t);
 const duration=sorted.length>1?(sorted[sorted.length-1].t-sorted[0].t)/1000:0;
 return {pressure,tilt,barrelButton,eraser,hz:duration>0?Math.round((sorted.length-1)/duration):0,pressureUnavailable:pen.length>=8&&!pressure};
}
/** Native Gesture Handler stylusData normalization. */
export function fromNativeStylus(x:number,y:number,t:number,pressure:number|undefined,tiltX=0,tiltY=0,twist=0,buttons=1):InputSample{
 return {x,y,t,pressure:pressure??0.5,tiltX,tiltY,twist,pointerType:'pen',buttons};
}
