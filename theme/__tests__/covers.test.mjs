import assert from 'node:assert/strict';
import test from 'node:test';
import {getPremiumCover,premiumCoverCollections,getSpecialCover,specialCoverCollection} from '../covers.ts';

test('four cover styles each offer three unique local variants',()=>{
 assert.equal(premiumCoverCollections.length,4);
 const ids=premiumCoverCollections.flatMap(collection=>collection.variants.map(variant=>variant.id));
 assert.equal(ids.length,12);
 assert.equal(new Set(ids).size,12);
 for(const id of ids)assert.match(getPremiumCover(id).color,/^#[0-9a-f]{6}$/i);
});

test('unknown or missing preset IDs safely return no preset',()=>{
 assert.equal(getPremiumCover(null),null);
 assert.equal(getPremiumCover('unknown-preset'),null);
});

test('previous Linen and Leather preset IDs remain readable',()=>{
 assert.equal(getPremiumCover('linen-sand')?.style,'linen');
 assert.equal(getPremiumCover('leather-espresso')?.style,'leather');
});

test('new styles resolve to distinct compositions even with identical base colors',()=>{
 const ids=premiumCoverCollections.map(collection=>collection.variants[0].id);
 assert.deepEqual(ids.map(id=>getPremiumCover(id)?.style),['classic','modern','editorial','abstract']);
});

test('four custom image covers have stable unique IDs',()=>{
 assert.deepEqual(specialCoverCollection.map(cover=>cover.id),['aurora','art-deco-emerald','y2k-holographic','lofi-sunset']);
 for(const cover of specialCoverCollection)assert.equal(getSpecialCover(cover.id),cover);
 assert.equal(getSpecialCover('missing'),null);
});
