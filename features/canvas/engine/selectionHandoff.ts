type Identified={id:string};

/** Serialized page content recreates element objects. Compare their saved values, not object identity. */
export function isSelectionHandoffCommitted<T extends Identified>(
 handoffElements:readonly T[]|null,
 contentElements:readonly Identified[]
):boolean{
 if(!handoffElements)return false;
 const byId=new Map(contentElements.map(element=>[element.id,element]));
 return handoffElements.every(element=>{
  const stored=byId.get(element.id);
  return !!stored&&(stored===element||JSON.stringify(stored)===JSON.stringify(element));
 });
}

/** Keep a final-geometry overlay visible after dismissal until page content catches up. */
export function needsReleasedSelectionHandoff(hasHandoff:boolean,committed:boolean,selectionToolActive:boolean,handoffMatchesSelection:boolean):boolean{
 return hasHandoff&&!committed&&(!selectionToolActive||!handoffMatchesSelection);
}

/** Once committed, the active selection layer must draw the final page objects directly. */
export function shouldUseCommittedSelectionGeometry(committed:boolean,handoffMatchesSelection:boolean):boolean{
 return committed&&handoffMatchesSelection;
}

/** A committed baseline still needs a live transform while the next gesture is active or awaiting commit. */
export function shouldApplySelectionPreviewTransform(committed:boolean,gestureActive:boolean,pending:boolean,handoffGeneration:number,gestureGeneration:number):boolean{
 'worklet';
 return !committed||gestureActive||(pending&&handoffGeneration!==gestureGeneration);
}

/** A recognized tap on empty page space dismisses an active selection only. */
export function shouldDismissSelectionOnBlankTap(selectionToolActive:boolean,hasSelection:boolean,hitElement:boolean):boolean{
 return selectionToolActive&&hasSelection&&!hitElement;
}
