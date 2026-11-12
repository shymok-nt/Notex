/** A clear-blend eraser preview can be released only after its exact result is rendered. */
export function hasCommittedErase<T>(expectedElements:T[]|null,renderedElements:T[]):boolean{
 return expectedElements!==null&&expectedElements===renderedElements;
}

export function shouldReleaseEraserHandoff<T>(expectedElements:T[]|null,renderedElements:T[],currentGeneration:number,scheduledGeneration:number):boolean{
 return hasCommittedErase(expectedElements,renderedElements)&&currentGeneration===scheduledGeneration;
}

export function isCurrentEraseHandoff(currentGeneration:number,commitGeneration:number):boolean{
 return currentGeneration===commitGeneration;
}
