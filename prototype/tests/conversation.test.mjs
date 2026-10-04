import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {runConversation,executeAgentTool,agentContext,agentBypass} from '../conversation.mjs';
import {processConversationalInbound} from '../conversational-shared.mjs';
import {initialize} from '../shared.mjs';import {offlineContext} from '../public/offline-conversation.js';
const model=JSON.parse(await readFile(new URL('../public/model.json',import.meta.url))),account={id:'farmer-conversation',name:'Ana',location:'Boa Vista',language:'en'},session={account,draft:{}},config={enabled:true,key:'test-only-key',model:'configured-test-model'};
const call=(name,args)=>({output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:'call-1'}]});
function provider(outputs,requests=[]){return async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');requests.push(JSON.parse(options.body));return {ok:true,json:async()=>outputs.shift()};};}
test('general conversation reads owner context, calls tools and stores bounded memory with provider storage disabled',async()=>{
 const requests=[],fetcher=provider([call('read_account',{}),{output:[{type:'message',content:[{type:'output_text',text:'What quantity of cassava will be ready?'}]}]}],requests);
 const context={lots:[{id:'mine',farmerId:account.id,crop:'cassava',quantityKg:80},{id:'private-other',farmerId:'other',crop:'tomato',quantityKg:999}]};
 const result=await runConversation('I want to plan my cassava harvest.',session,model,context,config,{fetcher});assert.match(result.reply,/cassava/);assert.equal(result.session.conversationMemory.length,2);assert.equal(requests[0].store,false);assert.equal(requests[0].parallel_tool_calls,false);assert.doesNotMatch(JSON.stringify(requests),/private-other|999/);assert.equal(result.lot,undefined);
});
test('model prepares an explicit harvest but cannot fabricate price, commit or access another lot',async()=>{
 const facts={crop:'cassava',quantityKg:80,grade:'B',harvestDate:'2026-10-04',localPriceBrl:4};
 let result=await runConversation('80 kg cassava, grade B, 2026-10-04, BRL 4/kg',session,model,{lots:[]},config,{fetcher:provider([call('prepare_harvest',facts)])});assert.equal(result.session.draft.crop,'cassava');assert.equal(result.lot,undefined);assert.match(result.reply,/CONFIRM/);
 await assert.rejects(runConversation('80 kg cassava',session,model,{lots:[]},config,{fetcher:provider([call('prepare_harvest',facts)])}),/not explicitly supplied/);
 assert.throws(()=>executeAgentTool('confirm',{},session,model,{}),/not allowed/);assert.throws(()=>executeAgentTool('check_options',{lotId:'someone-else'},session,model,{lots:[]}),/Owned lot/);
});
test('human confirmation and pending document or sales reviews bypass inference entirely',async()=>{
 let count=0;const fetcher=async()=>{count++;throw Error('Should not call');};
 for(const text of ['CONFIRM','CANCEL','LINK ABCD','LANGUAGE EN'])assert.equal(await runConversation(text,session,model,{},config,{fetcher}),null);
 assert.equal(await runConversation('please send it',{...session,pendingDelivery:{destination:'test@example.com'}},model,{},config,{fetcher}),null);assert.equal(count,0);assert.equal(agentBypass('I have maize',session),false);
});
test('provider outage falls back honestly, inbound duplicate does not call the provider twice',async()=>{
 const db=initialize({sessions:{'whatsapp:+test':session},accounts:{[account.id]:account}});let count=0;const dependencies={fetcher:async()=>{count++;throw Error('offline provider');}};
 const event={From:'whatsapp:+test',MessageSid:'SM-conversation-test',Body:'How should I plan my harvest?'};const env={OPENAI_API_KEY:'test',HARVESTLINK_CHAT_MODEL:'test'};
 const reply=await processConversationalInbound(db,event,model,'general',env,dependencies);assert.match(reply,/temporarily unavailable/);assert.equal(await processConversationalInbound(db,event,model,'general',env,dependencies),reply);assert.equal(count,1);
});
test('offline guidance uses only owned facts and is separate from model-generated transactions',()=>{
 const state={session,lots:[{id:'mine',farmerId:account.id,crop:'beans',quantityKg:12},{id:'other',farmerId:'other',quantityKg:999}],shared:{token:'secret'}};const context=offlineContext(state);assert.equal(context.lots.length,1);assert.doesNotMatch(JSON.stringify(context),/secret|999/);assert.match(context.mode,/no record writes/);
});
