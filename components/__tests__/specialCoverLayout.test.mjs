import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fitSpecialCoverImage} from '../specialCoverLayout.ts';

const covers=['6-aurora-bulanik','7-art-deco-zumrut','8-y2k-holografik','9-lofi-gunbatimi'];

for(const cover of covers){
 test(`${cover} fits the front at three sizes`,()=>{
  const file=fileURLToPath(new URL(`../../assets/covers/${cover}.png`,import.meta.url));
  const png=readFileSync(file);
  assert.equal(png.readUInt32BE(16),600);
  assert.equal(png.readUInt32BE(20),800);
  for(const [width,height] of [[90,120],[150,200],[240,320]]){
   const image=fitSpecialCoverImage(width,height);
   assert.deepEqual(image,{width,height});
  }
 });
}

test('image fits the full cover surface without a spine inset',()=>{
 for(const width of [48,76,120,210,240]){
  const height=width*4/3;
  const image=fitSpecialCoverImage(width,height);
  assert.ok(Math.abs(image.width-width)<1e-10);
  assert.ok(Math.abs(image.height-height)<1e-10);
  assert.ok(Math.abs(image.width/image.height-0.75)<1e-10);
 }
});
