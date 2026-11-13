export type TextBoxResizeInput={
 x:number;
 y:number;
 startWidth:number;
 startHeightPx:number;
 deltaX:number;
 deltaY:number;
 scale:number;
 pageWidth:number;
 pageHeight:number;
 minimumEditorHeight:number;
 contentHeightPx:number;
 manualMinHeight:number|null;
};

export type TextBoxResizeResult={width:number;heightPx:number;manualMinHeight:number|null};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Convert the single bottom-right handle's screen-space drag into page-space dimensions. */
export function resizeTextBox(input:TextBoxResizeInput):TextBoxResizeResult{
 const scale=Number.isFinite(input.scale)?Math.max(0.01,input.scale):1;
 const maxWidth=Math.max(1,input.pageWidth-input.x);
 const minWidth=Math.min(maxWidth,Math.max(60,80/scale));
 const width=clamp(input.startWidth+input.deltaX/scale,minWidth,maxWidth);
 const maxHeightPx=Math.max(0,input.pageHeight-input.y)*scale;
 const minimumHeightPx=Math.min(maxHeightPx,Math.max(0,input.minimumEditorHeight));
 const targetHeightPx=clamp(input.startHeightPx+input.deltaY,minimumHeightPx,maxHeightPx);
 let manualMinHeight=input.manualMinHeight;
 if(Math.abs(input.deltaY)>1.5){
  manualMinHeight=targetHeightPx>input.contentHeightPx+1?targetHeightPx/scale:null;
 }else if(Math.abs(input.deltaX)>1.5&&manualMinHeight===null&&input.startHeightPx>input.contentHeightPx+1){
  // A horizontal-only resize must not collapse a previously taller visible box.
  manualMinHeight=input.startHeightPx/scale;
 }
 const heightPx=clamp(Math.max(minimumHeightPx,input.contentHeightPx,(manualMinHeight??0)*scale),minimumHeightPx,maxHeightPx);
 return {width,heightPx,manualMinHeight};
}
