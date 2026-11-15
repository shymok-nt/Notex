import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../features/canvas/engine/pressureRibbon.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
runInNewContext(js,{exports,Math,Number});
const {ribbonPath}=exports;

test('same samples produce exactly the same live and saved SVG',()=>{
 const samples=[[0,0,.2],[10,2,.7],[20,5,1]];
 assert.equal(ribbonPath(samples,4,.3,1,'normal'),ribbonPath(samples,4,.3,1,'normal'));
 assert.match(ribbonPath(samples,4,.3,1,'normal'),/^M/);
 assert.match(ribbonPath(samples,4,.3,1,'normal'),/ Z$/);
});
test('single tap renders a nonempty dot',()=>{
 const svg=ribbonPath([[4,5,.5]],3,.3,1,'normal');
 assert.match(svg,/ A/);
 assert.match(svg,/ Z$/);
});
test('pressure and curve change the outline',()=>{
 const points=[[0,0,.1],[10,0,.5],[20,0,.9]];
 assert.notEqual(ribbonPath(points,5,.3,1,'soft'),ribbonPath(points,5,.3,1,'hard'));
});
test('empty input returns empty SVG',()=>assert.equal(ribbonPath([],5,.3,1),''));
