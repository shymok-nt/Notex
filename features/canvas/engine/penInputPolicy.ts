/** Pointer policy shared by the desktop adapter and test harness. */
export type PenButtonAction='eraser'|'select'|'hand'|'none';
export type PointerKind='pen'|'mouse'|'touch';
export type PenInputPolicy={stylusOnly:boolean;fingerDraw:boolean;palmRejection:boolean;palmDelayMs:number;buttonAction:PenButtonAction;eraserTipEnabled:boolean};
export type PointerDescriptor={pointerType:PointerKind;buttons:number;button:number;pressure:number;timeStamp:number};
export type PenProximity={lastPenTime:number;activePenPointers:Set<number>};
export const DEFAULT_PALM_DELAY_MS=350;
export function isEraserTip(pointer:Pick<PointerDescriptor,'buttons'|'button'>):boolean{return (pointer.buttons&32)!==0||pointer.button===5}
export function isBarrelButton(pointer:Pick<PointerDescriptor,'buttons'|'button'>):boolean{return !isEraserTip(pointer)&&((pointer.buttons&2)!==0||pointer.button===2)}
export function temporaryTool(pointer:PointerDescriptor,policy:PenInputPolicy):PenButtonAction|null{
 if(pointer.pointerType!=='pen')return null;
 if(policy.eraserTipEnabled&&isEraserTip(pointer))return 'eraser';
 if(isBarrelButton(pointer)&&policy.buttonAction!=='none')return policy.buttonAction;
 return null;
}
export function penIsNear(state:PenProximity,now:number,delayMs=DEFAULT_PALM_DELAY_MS):boolean{
 return state.activePenPointers.size>0||(state.lastPenTime>=0&&now-state.lastPenTime<=delayMs);
}
export function shouldBlockDrawing(pointer:PointerDescriptor,policy:PenInputPolicy,proximity:PenProximity):boolean{
 if(pointer.pointerType==='pen')return false;
 if(pointer.pointerType==='touch'&&policy.palmRejection&&penIsNear(proximity,pointer.timeStamp,policy.palmDelayMs))return true;
 return policy.stylusOnly||!policy.fingerDraw;
}
export function makePenProximity():PenProximity{return {lastPenTime:-Infinity,activePenPointers:new Set<number>()}}
export function observePenPointer(state:PenProximity,pointerId:number,pointer:PointerDescriptor,phase:'down'|'move'|'up'|'cancel'):void{
 if(pointer.pointerType!=='pen')return;
 state.lastPenTime=pointer.timeStamp;
 if(phase==='down')state.activePenPointers.add(pointerId);
 if(phase==='up'||phase==='cancel')state.activePenPointers.delete(pointerId);
}
