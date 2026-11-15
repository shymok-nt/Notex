type Identified={id:string};

/** Stable comparison across JSON round-trips, where object key insertion order can change. */
function stableValue(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(stableValue).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stableValue(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}


/** Serialized page content recreates element objects. Compare their saved values, not object identity. */
export function isSelectionHandoffCommitted<T extends Identified>(
 handoffElements:readonly T[]|null,
 contentElements:readonly Identified[]
):boolean{
 if(!handoffElements)return false;
 const byId=new Map(contentElements.map(element=>[element.id,element]));
 return handoffElements.every(element=>{
  const stored=byId.get(element.id);
  if(!stored)return false;
  if(stored===element)return true;
  const normalize=(item:Identified)=>{
   const value=item as Identified&{type?:string;bbox?:number[];minHeight?:number;fontFamily?:string;italic?:boolean;underline?:boolean};
   if(value.type!=='text')return value;
   return {...value,fontFamily:value.fontFamily??'Inter',italic:value.italic??false,underline:value.underline??false,minHeight:value.bbox?Math.max(24,value.bbox[3]-value.bbox[1]):value.minHeight};
  };
  return stableValue(normalize(stored))===stableValue(normalize(element));
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
