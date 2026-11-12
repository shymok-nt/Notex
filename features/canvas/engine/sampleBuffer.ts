export type Sample=[number,number,number];
// Chunks are grouped in a second level so appending a sample only copies the
// current 64-sample chunk and its small group, rather than the full list of
// chunks accumulated by a long stroke.
export type SampleBuffer={groups:Sample[][][];length:number};
export const SAMPLE_BUFFER_CHUNK_SIZE=64;
export const SAMPLE_BUFFER_GROUP_SIZE=64;

export const emptySampleBuffer=():SampleBuffer=>{'worklet';return {groups:[],length:0}};
export const sampleBufferFromPoint=(point:Sample):SampleBuffer=>{'worklet';return {groups:[[[point]]],length:1}};
export const sampleBufferAt=(buffer:SampleBuffer,index:number):Sample=>{'worklet';
 const chunkIndex=Math.floor(index/SAMPLE_BUFFER_CHUNK_SIZE);
 const groupIndex=Math.floor(chunkIndex/SAMPLE_BUFFER_GROUP_SIZE);
 return buffer.groups[groupIndex][chunkIndex%SAMPLE_BUFFER_GROUP_SIZE][index%SAMPLE_BUFFER_CHUNK_SIZE];
};
export const appendSample=(buffer:SampleBuffer,point:Sample):SampleBuffer=>{'worklet';
 const chunkIndex=Math.floor(buffer.length/SAMPLE_BUFFER_CHUNK_SIZE);
 const groupIndex=Math.floor(chunkIndex/SAMPLE_BUFFER_GROUP_SIZE);
 const chunkOffset=chunkIndex%SAMPLE_BUFFER_GROUP_SIZE;
 const groups=buffer.groups.slice();
 if(buffer.length%SAMPLE_BUFFER_CHUNK_SIZE===0){
  if(chunkOffset===0)groups.push([[point]]);
  else groups[groupIndex]=[...groups[groupIndex],[point]];
 }else{
  const group=groups[groupIndex].slice();
  group[chunkOffset]=[...group[chunkOffset],point];
  groups[groupIndex]=group;
 }
 return {groups,length:buffer.length+1};
};
export const flattenSamples=(buffer:SampleBuffer):Sample[]=>{'worklet';
 const points:Sample[]=[];
 for(let g=0;g<buffer.groups.length;g++)for(let c=0;c<buffer.groups[g].length;c++)for(let i=0;i<buffer.groups[g][c].length;i++)points.push(buffer.groups[g][c][i]);
 return points;
};
export const normalizeStylusPressure=(reported:number|undefined,sensitivity:number):number=>{'worklet';
 const pressure=typeof reported==='number'&&Number.isFinite(reported)?Math.max(0.05,Math.min(1,reported)):0.5;
 const safeSensitivity=Number.isFinite(sensitivity)?sensitivity:1;
 return Math.max(0.05,Math.min(1,0.5+(pressure-0.5)*safeSensitivity));
};
