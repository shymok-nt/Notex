import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {coverPalette,specialCoverCollection} from '../../theme/covers.ts';

test('every default color has a distinct 3:4 linen image',()=>{
 const assets=[];
 for(const {color} of coverPalette){
  const file=fileURLToPath(new URL(`../../assets/covers/default-linen/linen-${color.slice(1).toLowerCase()}.png`,import.meta.url));
  const png=readFileSync(file);
  assert.equal(png.readUInt32BE(16),450);
  assert.equal(png.readUInt32BE(20),600);
  assets.push(png.toString('base64'));
 }
 assert.equal(new Set(assets).size,coverPalette.length);
 assert.ok(specialCoverCollection.every(cover=>!cover.id.includes('keten')));
});
