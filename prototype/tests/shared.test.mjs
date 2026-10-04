import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initialize,requestLink,claimLink,authenticateDevice,processInbound,snapshot,syncDevice} from '../shared.mjs';
import {HarvestIntentModel} from '../public/ai/predict.mjs';
const read=p=>readFile(new URL('../public/ai/model/'+p,import.meta.url));
const [m,v,w]=await Promise.all(['metadata.json','vocabulary.json','weights.f32'].map(read));const model=new HarvestIntentModel(JSON.parse(m),JSON.parse(v),w.buffer.slice(w.byteOffset,w.byteOffset+w.byteLength));
let sid=0;const send=(db,from,body)=>processInbound(db,{From:from,Body:body,MessageSid:'SM-'+(++sid)},model);
function onboard(db,from,name='Ana'){for(const text of ['INICIAR','PT','ACEITO',name,'Boa Vista','PT','CONFIRMO'])send(db,from,text);return db.sessions[from].account.id;}
function link(db,from){const r=requestLink(db,'test phone');send(db,from,r.command);send(db,from,'CONFIRMO');return claimLink(db,r.id,r.claim);}
test('verified linking requires onboarding, provider identity and a second confirmation; expires and claims once',()=>{
 const db=initialize({}),r=requestLink(db,'phone',1000);assert.equal(claimLink(db,r.id,r.claim,1001).state,'pending');
 assert.throws(()=>claimLink(db,r.id,'wrong',1001),e=>e.status===401);assert.throws(()=>claimLink(db,r.id,r.claim,601001),e=>e.status===410);
 const a=onboard(db,'whatsapp:+111','Ana'),b=onboard(db,'whatsapp:+222','Ana'),real=requestLink(db,'my phone');
 send(db,'whatsapp:+111',real.command);assert.equal(claimLink(db,real.id,real.claim).state,'pending');
 assert.match(send(db,'whatsapp:+222',real.command),/outro número/);send(db,'whatsapp:+111','CONFIRMO');const claimed=claimLink(db,real.id,real.claim);
 assert.equal(claimed.snapshot.account.id,a);assert.notEqual(a,b);assert.throws(()=>claimLink(db,real.id,real.claim),e=>e.status===401);
 assert.equal(authenticateDevice(db,claimed.token).farmerId,a);assert.ok(!JSON.stringify(db.devices).includes(claimed.token));
});
test('WhatsApp and companion read/write the same owner-scoped account; retries and runtime restart preserve it',()=>{
 let db=initialize({});const id=onboard(db,'whatsapp:+111'),other=onboard(db,'whatsapp:+222','Bia');
 send(db,'whatsapp:+111','tenho 120 kg de mandioca, classe A, 2026-10-04, BRL 4/kg');send(db,'whatsapp:+111','CONFIRMO');
 send(db,'whatsapp:+222','tenho 80 kg de milho, classe A, 2026-10-04, BRL 3/kg');send(db,'whatsapp:+222','CONFIRMO');
 const linked=link(db,'whatsapp:+111'),device=authenticateDevice(db,linked.token);assert.equal(linked.snapshot.lots.length,1);
 const lot={...linked.snapshot.lots[0],id:crypto.randomUUID(),quantityKg:45,source:'offline-app'};delete lot.providerSid;
 const payload={operationId:crypto.randomUUID(),baseRevision:linked.snapshot.revision,lots:[lot],choices:[],supportRequests:[]};
 const received=syncDevice(db,device,payload);assert.equal(received.snapshot.lots.length,2);assert.match(send(db,'whatsapp:+111','LOTES'),/45 kg/);assert.doesNotMatch(send(db,'whatsapp:+222','LOTES'),/45 kg/);
 assert.equal(syncDevice(db,device,payload).operationId,received.operationId);assert.equal(db.lots.filter(l=>l.id===lot.id).length,1);
 db=initialize(JSON.parse(JSON.stringify(db)));assert.equal(snapshot(db,authenticateDevice(db,linked.token).farmerId).lots.length,2);assert.equal(snapshot(db,other).lots.length,1);
});
test('stale revisions, another farmer’s lots and partial invalid batches cannot overwrite shared data',()=>{
 const db=initialize({}),id=onboard(db,'whatsapp:+111'),other=onboard(db,'whatsapp:+222','Bia');
 const linked=link(db,'whatsapp:+111'),device=authenticateDevice(db,linked.token),base={operationId:crypto.randomUUID(),baseRevision:linked.snapshot.revision,lots:[],choices:[],supportRequests:[]};
 send(db,'whatsapp:+111','ALTERAR NOME Ana Maria');send(db,'whatsapp:+111','CONFIRMO');
 assert.throws(()=>syncDevice(db,device,base),e=>e.status===409);assert.equal(db.accounts[id].name,'Ana Maria');
 const lot={id:crypto.randomUUID(),farmer:'Ana',farmerId:id,location:'Boa Vista',crop:'maize',quantityKg:20,grade:'A',harvestDate:'2026-10-04',localPriceBrl:4,confirmedAt:new Date().toISOString(),confirmation:'explicit farmer confirmation',status:'available',source:'offline-app'};
 const batch={...base,baseRevision:db.accounts[id].revision,lots:[lot,{...lot,id:crypto.randomUUID(),farmerId:other}]};
 assert.throws(()=>syncDevice(db,device,batch),e=>e.status===400);assert.equal(db.lots.length,0);
});
test('revocation disables device credentials without erasing farmer records',()=>{
 const db=initialize({});onboard(db,'whatsapp:+111');const linked=link(db,'whatsapp:+111');send(db,'whatsapp:+111','DESVINCULAR');assert.ok(authenticateDevice(db,linked.token));send(db,'whatsapp:+111','CONFIRMO');assert.throws(()=>authenticateDevice(db,linked.token),e=>e.status===401);assert.equal(Object.keys(db.accounts).length,1);
});
