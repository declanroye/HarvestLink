import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {handleFarmerMessage} from '../public/account.js';import {initialize,processInbound,requestLink} from '../shared.mjs';
const model=JSON.parse(await readFile(new URL('../public/model.json',import.meta.url),'utf8')),context={profile:{id:'general'},order:null,lots:[],choices:[],offline:true};
test('RESTART resets incomplete onboarding before language selection and preserves an existing account',()=>{
 let r=handleFarmerMessage('RESTART',{language:'pt',draft:{crop:'tomato'},onboarding:{step:'location',draft:{name:'CONFIRM',language:'pt'}}},model,context);
 assert.match(r.reply,/EN for English/);assert.deepEqual(r.session.onboarding,{step:'language',draft:{}});
 r=handleFarmerMessage('EN',r.session,model,context);assert.match(r.reply,/I AGREE/);
 const account={id:'keep-id',name:'Ana',location:'Lethem',language:'pt'};
 r=handleFarmerMessage('RESTART',{account,draft:{}},model,context);r=handleFarmerMessage('EN',r.session,model,context);
 assert.equal(r.session.account.id,'keep-id');assert.equal(r.session.account.language,'en');
});
function englishAccount(){let r=handleFarmerMessage('START',{draft:{}},model,context);assert.match(r.reply,/EN for English/);r=handleFarmerMessage('I speak English',r.session,model,context);assert.match(r.reply,/I AGREE/);assert.equal(r.session.onboarding.step,'consent');r=handleFarmerMessage('I AGREE',r.session,model,context);assert.match(r.reply,/What should we call/);r=handleFarmerMessage('Ana',r.session,model,context);assert.match(r.reply,/Which town/);r=handleFarmerMessage('Boa Vista',r.session,model,context);assert.match(r.reply,/Reply CONFIRM/);assert.equal(r.session.account,undefined);r=handleFarmerMessage('CONFIRM',r.session,model,context);assert.match(r.reply,/Profile saved/);assert.equal(r.session.account.language,'en');return r.session;}
test('legacy Portuguese consent switches to English on I AGREE; CONFIRM cannot become a name',()=>{let r=handleFarmerMessage('I AGREE',{draft:{},onboarding:{step:'consent',draft:{language:'pt'}}},model,context);assert.match(r.reply,/What should we call/);assert.equal(r.session.onboarding.draft.language,'en');r=handleFarmerMessage('CONFIRM',r.session,model,context);assert.match(r.reply,/What should we call/);assert.equal(r.session.onboarding.step,'name');assert.equal(r.session.onboarding.draft.name,undefined);});
test('EN changes a mid-onboarding language and repairs a command saved as a name',()=>{let r=handleFarmerMessage('EN',{draft:{},onboarding:{step:'location',draft:{name:'CONFIRM'}}},model,context);assert.match(r.reply,/What should we call/);assert.equal(r.session.onboarding.draft.name,undefined);r=handleFarmerMessage('Ana',r.session,model,context);assert.match(r.reply,/Which town/);r=handleFarmerMessage('PT',r.session,model,context);assert.match(r.reply,/Em qual cidade/);assert.equal(r.session.onboarding.step,'location');assert.equal(r.session.onboarding.draft.name,'Ana');});
test('language is first; English stays selected through consent and profile confirmation',()=>{const session=englishAccount();assert.match(handleFarmerMessage('MENU',session,model,context).reply,/CONFIRM saves/);assert.match(handleFarmerMessage('LANGUAGE PT',session,model,context).reply,/português/);});
test('English harvest questions, correction, confirmation, lists and withdrawal work end to end',()=>{
 let s=englishAccount(),r=handleFarmerMessage('HARVEST',s,model,context);assert.match(r.reply,/What do you have/);
 r=handleFarmerMessage('I have 120 kg of tomatoes',r.session,model,context);assert.match(r.reply,/What is the grade/);
 r=handleFarmerMessage('grade A',r.session,model,context);assert.match(r.reply,/harvest date/);
 r=handleFarmerMessage('2026-10-04',r.session,model,context);assert.match(r.reply,/local price/);
 r=handleFarmerMessage('BRL 3.50/kg',r.session,model,context);assert.match(r.reply,/Reply CONFIRM/);assert.equal(r.lot,undefined);
 r=handleFarmerMessage('80 kg',r.session,model,context);assert.match(r.reply,/80 kg tomatoes/);
 r=handleFarmerMessage('CONFIRM',r.session,model,context);assert.match(r.reply,/Lot confirmed: 80 kg, grade A/);assert.equal(r.lot.quantityKg,80);s=r.session;const ctx={...context,lots:[r.lot]};
 assert.match(handleFarmerMessage('LOTS',s,model,ctx).reply,/available/);assert.match(handleFarmerMessage('COMPARE EARNINGS',s,model,ctx).reply,/no buyer offer/);
 r=handleFarmerMessage('WITHDRAW LOT '+ctx.lots[0].id.slice(0,8),s,model,ctx);assert.match(r.reply,/Withdraw 80 kg/);r=handleFarmerMessage('CONFIRM',r.session,model,ctx);assert.match(r.reply,/Lot withdrawn/);assert.equal(r.lotUpdate.status,'withdrawn');
});
test('English cancellation and invalid input never fall back to Portuguese',()=>{const s=englishAccount();assert.match(handleFarmerMessage('CANCEL',s,model,context).reply,/Draft cancelled/);assert.match(handleFarmerMessage('SUPPORT',s,model,context).reply,/Support request saved/);assert.match(handleFarmerMessage('CHOOSE PROPOSAL',s,model,context).reply,/no buyer offer/);assert.match(handleFarmerMessage('WITHDRAW LOT unknown',s,model,context).reply,/Lot ID not found/);});
test('provider session keeps English after restart and localizes linking confirmation',()=>{
 let db=initialize({}),i=0;const send=t=>processInbound(db,{From:'whatsapp:+language-test',Body:t,MessageSid:'SM-lang-'+(++i)},model);
 assert.match(send('EN'),/I AGREE/);for(const t of ['I AGREE','Ana','Boa Vista','CONFIRM'])send(t);db=initialize(JSON.parse(JSON.stringify(db)));assert.match(send('HARVEST'),/What do you have/);const pair=requestLink(db,'My phone');assert.match(send('LINK '+pair.code),/Reply CONFIRM/);assert.match(send('CONFIRM'),/Phone verified/);
});
