type Sample=[number,number,number];

const pathNumber=(value:number)=>{'worklet';return String(value)};
const sampleCommand=(command:'M'|'L',sample:Sample)=>{'worklet';return `${command}${pathNumber(sample[0])} ${pathNumber(sample[1])}`};

/** Build a raw polyline through the samples without curve fitting. */
export function centerlinePathString(samples:readonly Sample[]):string{'worklet';
 if(!samples.length)return '';
 let path=sampleCommand('M',samples[0]);
 for(let index=1;index<samples.length;index++)path+=` ${sampleCommand('L',samples[index])}`;
 return path;
}

/** Append one real pointer sample to the active raw path. */
export function appendPolylinePoint(path:string,sample:Sample):string{'worklet';
 return `${path} ${sampleCommand('L',sample)}`;
}

const legacyKnotSpan=(a:Sample,b:Sample)=>{'worklet';return Math.sqrt(Math.hypot(b[0]-a[0],b[1]-a[1]))};
const legacySegment=(previous:Sample,start:Sample,end:Sample,next:Sample):string=>{'worklet';
 const segmentSpan=legacyKnotSpan(start,end);
 if(segmentSpan<0.000001)return `L${pathNumber(end[0])} ${pathNumber(end[1])}`;
 const previousSpan=Math.max(0.000001,legacyKnotSpan(previous,start)||segmentSpan);
 const nextSpan=Math.max(0.000001,legacyKnotSpan(end,next)||segmentSpan);
 const firstScale=segmentSpan/(3*(previousSpan+segmentSpan));
 const secondScale=segmentSpan/(3*(segmentSpan+nextSpan));
 const c1x=start[0]+(end[0]-previous[0])*firstScale;
 const c1y=start[1]+(end[1]-previous[1])*firstScale;
 const c2x=end[0]-(next[0]-start[0])*secondScale;
 const c2y=end[1]-(next[1]-start[1])*secondScale;
 return `C${pathNumber(c1x)} ${pathNumber(c1y)} ${pathNumber(c2x)} ${pathNumber(c2y)} ${pathNumber(end[0])} ${pathNumber(end[1])}`;
};

/** Retain the pre-raw renderer for strokes saved with the legacy centerline mode. */
export function legacyCenterlinePathString(samples:readonly Sample[]):string{'worklet';
 if(!samples.length)return '';
 let path=sampleCommand('M',samples[0]);
 if(samples.length===2)return path+` ${sampleCommand('L',samples[1])}`;
 for(let index=0;index<samples.length-1;index++){
  path+=` ${legacySegment(samples[Math.max(0,index-1)],samples[index],samples[index+1],samples[Math.min(samples.length-1,index+2)])}`;
 }
 return path;
}
