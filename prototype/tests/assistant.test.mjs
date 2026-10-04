import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {handleFarmerMessage} from '../public/account.js';import {demoCosts} from '../public/core.js';import {marketPoolLots,marketOrders} from '../public/marketplace.js';
const model=JSON.parse(await readFile(new URL('../public/model.json',import.meta.url))),account={id:'farmer-agent',name:'Declan',location:'Bonfim',language:'en'},lot={id:'lot-agent-001',farmerId:account.id,farmer:'Declan',location:'Bonfim',crop:'tomato',quantityKg:120,grade:'A',harvestDate:'2026-10-04',localPriceBrl:3.5,confirmedAt:'2026-10-04T01:00:00Z',status:'available'};
const base={account,draft:{},lastLotId:lot.id,demoMarketplace:true},context={lots:[lot],choices:[],handovers:[],costs:demoCosts,order:marketOrders[0]};
test('goal planning persists and the same grounded recommendation works online and offline without saving a choice',()=>{
 let r=handleFarmerMessage('Help me sell my harvest',base,model,context);assert.match(r.reply,/I checked compatible demo buyers/);assert.equal(r.session.assistant.goal,'Help me sell my harvest');
 const session=JSON.parse(JSON.stringify(r.session));r=handleFarmerMessage('What is my best option?',session,model,{...context,lots:marketPoolLots(context.lots,marketOrders[0]),offline:true});
 assert.match(r.reply,/120 kg/);assert.match(r.reply,/530.25/);assert.match(r.reply,/390.00/);assert.match(r.reply,/nothing is sent/);assert.equal(r.choice,undefined);assert.equal(r.session.pendingChoice,undefined);
 const online=handleFarmerMessage('What is my best option?',session,model,context);assert.match(online.reply,/530.25/);assert.match(online.reply,/fictional/);
});
test('memory is owner-scoped and natural language does not bypass pending confirmation',()=>{
 const other={...lot,id:'other-lot',farmerId:'another',quantityKg:999};let r=handleFarmerMessage('What do you know about me?',base,model,{...context,lots:[lot,other]});assert.match(r.reply,/1 confirmed/);assert.doesNotMatch(r.reply,/999/);
 r=handleFarmerMessage('book a pickup',base,model,context);assert.match(r.reply,/Not booked/);assert.equal(r.handover,undefined);
 r=handleFarmerMessage('What is my best option?',{...base,pendingAccount:{name:'Changed'}},model,context);assert.match(r.reply,/CONFIRM/);assert.equal(r.session.account.name,'Declan');
});
test('Portuguese goal guidance and multiple-lot selection stay grounded',()=>{
 let r=handleFarmerMessage('Qual a melhor opção?',{...base,account:{...account,language:'pt'}},model,context);assert.match(r.reply,/Verifiquei compradores/);assert.match(r.reply,/530.25/);
 const two={...context,lots:[lot,{...lot,id:'second-lot',quantityKg:30}]};r=handleFarmerMessage('What is my best option?',{...base,lastLotId:null},model,two);assert.match(r.reply,/USE LOT/);
 r=handleFarmerMessage('USE LOT lot-agent',base,model,two);assert.equal(r.session.lastLotId,lot.id);
});

test('expired assumptions stop a recommendation and an embedded harvest remains usable',()=>{let r=handleFarmerMessage('What is my best option?',base,model,{...context,costs:{...demoCosts,validUntil:'2020-01-01'}});assert.match(r.reply,/costs have expired/);assert.doesNotMatch(r.reply,/530.25/);r=handleFarmerMessage('Help me sell 120 kg of tomatoes',{account,draft:{}},model,context);assert.equal(r.session.draft.quantityKg,120);assert.match(r.reply,/grade/);assert.equal(r.session.assistant.goal,'Help me sell 120 kg of tomatoes');});

test('confirmed harvest proactively checks options and remembers review target without committing a sale',()=>{let r=handleFarmerMessage('CONFIRM',{...base,draft:{farmer:account.name,location:lot.location,crop:lot.crop,quantityKg:120,grade:'A',harvestDate:lot.harvestDate,localPriceBrl:3.5} },model,{...context,lots:[]});assert.ok(r.lot);assert.match(r.reply,/also checked/);assert.match(r.reply,/530.25/);assert.equal(r.session.assistant.recommendedOrderId,'DEMO-TOMATO');assert.equal(r.choice,undefined);const review=handleFarmerMessage('review that offer',r.session,model,{...context,lots:[r.lot]});assert.equal(review.session.marketOrderId,'DEMO-TOMATO');assert.equal(review.choice,undefined);});
