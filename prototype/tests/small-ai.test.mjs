import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {HarvestIntentModel} from '../public/ai/predict.mjs';import {handleFarmerMessage} from '../public/account.js';
const read=p=>readFile(new URL('../public/ai/model/'+p,import.meta.url));const [m,v,w]=await Promise.all(['metadata.json','vocabulary.json','weights.f32'].map(read));
const model=new HarvestIntentModel(JSON.parse(m),JSON.parse(v),w.buffer.slice(w.byteOffset,w.byteOffset+w.byteLength));
test('starter export matches all 88 Python reference predictions and numeric scores',async()=>{
 const refs=JSON.parse(await readFile(new URL('../ai-starter/parity_reference.json',import.meta.url),'utf8'));assert.equal(refs.length,88);
 for(const r of refs){const actual=model.predict(r.text);assert.equal(actual.intent,r.pythonPrediction);for(let i=0;i<r.scores.length;i++)assert.ok(Math.abs(actual.scores[i]-r.scores[i])<1e-5);}
});
test('exact shipped sizes and conservative empty/out-of-domain handling',async()=>{
 const runtime=await readFile(new URL('../public/ai/predict.mjs',import.meta.url));assert.equal(m.length+v.length+w.length,125597);assert.equal(runtime.length,2587);
 assert.equal(model.predict('').needsClarification,true);assert.equal(model.predict('zyx qqq').needsClarification,true);
});
test('actual learned model drives intake but never saves without human confirmation',()=>{
 let session={draft:{},account:{id:'farmer-test',name:'Ana',location:'Boa Vista',language:'pt'}};
 let r=handleFarmerMessage('Minha safra de tomate esta pronta. Quero vender.',session,model,{profile:{id:'general'},order:null,lots:[]});assert.equal(r.intent.rawIntent,'offer');assert.equal(r.lot,undefined);
 r=handleFarmerMessage('120 kg, classe A, 2026-10-04, BRL 3,50/kg',r.session,model,{profile:{id:'general'},order:null,lots:[]});assert.match(r.reply,/CONFIRMO/);assert.equal(r.lot,undefined);
 r=handleFarmerMessage('CONFIRMO',r.session,model,{profile:{id:'general'},order:null,lots:[]});assert.equal(r.lot.quantityKg,120);assert.equal(r.lot.farmerId,'farmer-test');
});
