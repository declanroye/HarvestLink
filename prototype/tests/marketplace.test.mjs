import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {HarvestIntentModel} from '../public/ai/predict.mjs';import {initialize,processInbound,snapshot} from '../shared.mjs';
const root=new URL('../public/ai/model/',import.meta.url),metadata=JSON.parse(await readFile(new URL('metadata.json',root))),vocab=JSON.parse(await readFile(new URL('vocabulary.json',root))),buffer=await readFile(new URL('weights.f32',root));
const model=new HarvestIntentModel(metadata,vocab,buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
test('actual small AI, opted-in fictional pool, confirmed choice and exporter handover share one account',()=>{
 let db=initialize({}),sid=0;const send=text=>processInbound(db,{From:'whatsapp:+demo-market',MessageSid:'DEMO-'+(++sid),Body:text},model);
 for(const text of ['EN','I AGREE','Declan','Bonfim','CONFIRM'])send(text);
 assert.match(send('MARKET'),/DEMO MARKET/);assert.equal(db.lots.length,0);
 assert.match(send('DEMO MARKET'),/fictional/);
 assert.match(send('I have 120 kg of tomatoes'),/grade/);
 for(const text of ['grade A','2026-10-04','BRL 3.50/kg'])send(text);
 assert.equal(db.lots.length,0);assert.match(send('CONFIRM'),/Lot confirmed/);assert.equal(db.lots.length,1);
 const farmerId=db.sessions['whatsapp:+demo-market'].account.id;
 assert.equal(snapshot(db,farmerId).marketplace.pooledKg,200);assert.equal(snapshot(db,farmerId).marketplace.syntheticKg,80);
 assert.match(send('MARKET'),/200\/200/);assert.match(send('LOGISTICS'),/Not booked/);assert.match(send('TRADE'),/unchecked/);
 assert.match(send('HANDOVER'),/First compare/);
 assert.match(send('COMPARE EARNINGS'),/Local net:.*390.00/);
 assert.match(send('CHOOSE PROPOSAL'),/Reply CONFIRM/);assert.equal(db.choices.length,0);send('CONFIRM');assert.equal(db.choices.length,1);
 assert.match(send('HANDOVER'),/Review DEMO/);assert.equal(db.handovers.length,0);send('CONFIRM');assert.equal(db.handovers.length,1);
 db=initialize(JSON.parse(JSON.stringify(db)));const view=snapshot(db,farmerId).marketplace;
 assert.equal(view.handovers.length,1);assert.equal(view.handovers[0].dispatchAuthorized,false);assert.equal(view.handovers[0].farmerId,farmerId);
 assert.equal(db.lots.some(l=>l.synthetic),false);assert.equal(view.ownAllocations.length,1);assert.match(view.status,/awaiting buyer confirmation/);
});
test('wrong-region farmer availability cannot fill a demo pool',()=>{
 const db=initialize({});let sid=0;const send=Body=>processInbound(db,{From:'whatsapp:+wrong-region',MessageSid:'WRONG-'+(++sid),Body},model);
 for(const t of ['EN','I AGREE','Ana','Manaus','CONFIRM','DEMO MARKET','I have 120 kg of tomatoes, grade A, 2026-10-04, BRL 3.50/kg','CONFIRM'])send(t);
 const id=db.sessions['whatsapp:+wrong-region'].account.id;assert.equal(snapshot(db,id).marketplace.pooledKg,80);assert.equal(snapshot(db,id).marketplace.ownAllocations.length,0);
 assert.match(send('COMPARE EARNINGS'),/Confirm your lot first/);assert.equal(db.handovers.length,0);
});
