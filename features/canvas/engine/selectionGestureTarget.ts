/** Keep the center of a small selection draggable when corner hit areas overlap. */
export function shouldGrabSelectionCorner(
 point:readonly number[],
 corner:readonly [number,number],
 center:readonly [number,number],
 radius:number
):boolean{
 'worklet';
 return Math.hypot(point[0]-corner[0],point[1]-corner[1])<=radius&&
  Math.hypot(point[0]-center[0],point[1]-center[1])>radius;
}
