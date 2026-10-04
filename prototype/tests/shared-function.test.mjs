import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import twilio from 'twilio';
const replySource=await readFile(new URL('../twilio/harvestlink-reply.protected.js',import.meta.url),'utf8'),apiSource=await readFile(new URL('../twilio/harvestlink-companion.public.js',import.meta.url),'utf8');
class Response{constructor(){this.headers={};}appendHeader(k,v){this.headers[k]=v;}setStatusCode(s){this.status=s;}setBody(b){this.body=b;}}
const handler=source=>{const sandbox={exports:{},require:createRequire(import.meta.url),Twilio:{...twilio,Response},Buffer,console,structuredClone};vm.runInNewContext(source,sandbox);return sandbox.exports.handler;};
test('paired Functions use one durable Sync store for WhatsApp verification and companion records',async()=>{
 let stored,revision=0;const documents=()=>({fetch:async()=>{if(!stored)throw {status:404};return {data:stored,revision:String(revision)};},update:async({data,ifMatch})=>{assert.equal(ifMatch,String(revision));stored=data;revision++;}});documents.create=async({data})=>{stored=data;return {data,revision:String(revision)};};
 const ctx={SYNC_SERVICE_SID:'test',COMPANION_ORIGINS:'https://declanroye.github.io',getTwilioClient:()=>({sync:{v1:{services:()=>({documents})}}})},invoke=(source,event)=>new Promise((resolve,reject)=>handler(source)(ctx,event,(e,r)=>e?reject(e):resolve(r)));
 let sid=0;const send=body=>invoke(replySource,{From:'whatsapp:+test',MessageSid:'SM-'+(++sid),Body:body});
 const api=(action,input={},token='',origin='https://declanroye.github.io')=>invoke(apiSource,{action,input:JSON.stringify(input),token,request:{headers:{origin}}});
 assert.equal((await api('snapshot')).status,401);assert.equal((await api('link/request',{},'','https://bad.invalid')).status,403);
 for(const text of ['INICIAR','PT','ACEITO','Ana','Boa Vista','PT','CONFIRMO'])await send(text);
 const pair=(await api('link/request',{label:'phone'})).body;await send(pair.command);assert.equal((await api('link/claim',pair)).body.state,'pending');await send('CONFIRMO');const linked=(await api('link/claim',pair)).body;assert.equal(linked.state,'linked');
 await send('tenho 25 kg de milho, classe A, 2026-10-04, BRL 3/kg');await send('CONFIRMO');const shared=(await api('snapshot',{},linked.token)).body;assert.equal(shared.lots.length,1);assert.equal(shared.account.id,linked.snapshot.account.id);
 const lot={...shared.lots[0],id:crypto.randomUUID(),quantityKg:40};delete lot.providerSid;
 const received=await api('sync',{operationId:crypto.randomUUID(),baseRevision:shared.revision,lots:[lot],choices:[],supportRequests:[]},linked.token);assert.equal(received.status,200);assert.match((await send('LOTES')).toString(),/40 kg/);
 await send('DEMO MARKET');await send('OFFER DEMO-CASSAVA');await send('tenho 220 kg de mandioca, classe A, 2026-10-04, BRL 3.50/kg');await send('CONFIRMO');
 const marketplace=(await api('snapshot',{},linked.token)).body.marketplace;assert.equal(marketplace.pooledKg,300);assert.equal(marketplace.syntheticKg,80);
 await send('ESCOLHO PROPOSTA');await send('CONFIRMO');await send('HANDOVER');await send('CONFIRMO');
 const handovers=(await api('snapshot',{},linked.token)).body.marketplace.handovers;assert.equal(handovers.length,1);assert.equal(handovers[0].dispatchAuthorized,false);
});
