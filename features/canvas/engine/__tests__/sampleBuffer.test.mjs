import test from 'node:test';
import assert from 'node:assert/strict';
import {appendSample,emptySampleBuffer,flattenSamples,normalizeStylusPressure,sampleBufferAt,SAMPLE_BUFFER_CHUNK_SIZE,SAMPLE_BUFFER_GROUP_SIZE} from '../sampleBuffer.ts';

test('64-point chunks preserve order across boundaries and flatten without loss',()=>{
 let buffer=emptySampleBuffer();
 const expected=[];
 for(let index=0;index<130;index++){
  const point=[index,index*2,index/130];
  expected.push(point);
  buffer=appendSample(buffer,point);
 }
 assert.equal(SAMPLE_BUFFER_CHUNK_SIZE,64);
 assert.deepEqual(buffer.groups.flatMap(group=>group.map(chunk=>chunk.length)),[64,64,2]);
 assert.equal(buffer.length,130);
 assert.deepEqual(sampleBufferAt(buffer,63),expected[63]);
 assert.deepEqual(sampleBufferAt(buffer,64),expected[64]);
 assert.deepEqual(sampleBufferAt(buffer,127),expected[127]);
 assert.deepEqual(sampleBufferAt(buffer,128),expected[128]);
 assert.deepEqual(flattenSamples(buffer),expected);
});

test('grouped chunks preserve ordering across a group boundary for long strokes',()=>{
 let buffer=emptySampleBuffer();
 const total=SAMPLE_BUFFER_CHUNK_SIZE*SAMPLE_BUFFER_GROUP_SIZE+3;
 for(let index=0;index<total;index++)buffer=appendSample(buffer,[index,index+1,0.5]);
 assert.equal(buffer.groups.length,2);
 assert.equal(buffer.groups[0].length,SAMPLE_BUFFER_GROUP_SIZE);
 assert.equal(buffer.groups[1].length,1);
 assert.deepEqual(sampleBufferAt(buffer,total-1),[total-1,total,0.5]);
 const flattened=flattenSamples(buffer);
 assert.equal(flattened.length,total);
 assert.deepEqual(flattened[0],[0,1,0.5]);
 assert.deepEqual(flattened.at(-1),[total-1,total,0.5]);
});

test('invalid pressure falls back safely and valid pressure only changes width input',()=>{
 assert.equal(normalizeStylusPressure(undefined,1),0.5);
 assert.equal(normalizeStylusPressure(Number.NaN,1),0.5);
 assert.equal(normalizeStylusPressure(Number.POSITIVE_INFINITY,1),0.5);
 assert.equal(normalizeStylusPressure(0.8,1),0.8);
 assert.equal(normalizeStylusPressure(0.8,0),0.5);
 assert.equal(normalizeStylusPressure(3,1),1);
});
