import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import twilio from 'twilio';
test('HTTP signed WhatsApp linking, offline upload, scoped fetch, conflict and persistent restart',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'harvestlink-link-')),port=4189,base=`http://127.0.0.1:${port}`,webhook=base+'/webhooks/twilio',auth='synthetic-link-test',origin='https://declanroye.github.io';let child,seq=0;
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:dir,COMPANION_ORIGINS:origin,TWILIO_ACCOUNT_SID:'AC'+'0'.repeat(32),TWILIO_AUTH_TOKEN:auth,TWILIO_FROM:'+15005550006',PUBLIC_WEBHOOK_URL:webhook}});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',d=>{if(d.toString().includes('HarvestLink:')){clearTimeout(timer);resolve();}});child.once('exit',c=>{clearTimeout(timer);reject(Error('Exit '+c));});});};
 const stop=async()=>{if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}};
 const send=async(body)=>{const p={From:'whatsapp:+15005550009',To:'whatsapp:+15005550006',Body:body,MessageSid:'SM-synthetic-'+(++seq)};const r=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':twilio.getExpectedTwilioSignature(auth,webhook,p)},body:new URLSearchParams(p)});assert.equal(r.status,200);return r.text();};
 const api=(route,input,token)=>fetch(base+'/companion/'+route,{method:input?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:input?JSON.stringify(input):undefined});
 try{
  await start();assert.equal((await api('snapshot')).status,401);
  assert.equal((await fetch(base+'/companion/link/request',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
  for(const t of ['INICIAR','ACEITO','Ana','Boa Vista','PT','CONFIRMO'])await send(t);
  const pairing=await (await api('link/request',{label:'test companion'})).json();assert.equal((await (await api('link/claim',pairing)).json()).state,'pending');
  await send(pairing.command);await send('CONFIRMO');const linked=await (await api('link/claim',pairing)).json();assert.equal(linked.state,'linked');assert.equal((await api('link/claim',pairing)).status,401);
  const lot={id:crypto.randomUUID(),farmerId:linked.snapshot.account.id,farmer:'Ana',crop:'cassava',location:'Boa Vista',quantityKg:90,grade:'A',harvestDate:'2026-10-04',localPriceBrl:4,confirmedAt:new Date().toISOString(),confirmation:'explicit farmer confirmation',status:'available',source:'offline-app'};
  const batch={operationId:crypto.randomUUID(),baseRevision:linked.snapshot.revision,lots:[lot],choices:[],supportRequests:[]};
  let r=await api('sync',batch,linked.token);assert.equal(r.status,200);const receipt=await r.json();assert.match(receipt.status,/not buyer/);assert.equal(receipt.snapshot.lots.length,1);
  assert.equal((await api('sync',batch,linked.token)).status,200);assert.match(await send('LOTES'),/90 kg/);
  await send('ALTERAR LOCAL Bonfim');await send('CONFIRMO');assert.equal((await api('sync',{...batch,operationId:crypto.randomUUID()},linked.token)).status,409);
  await stop();await start();const restored=await (await api('snapshot',undefined,linked.token)).json();assert.equal(restored.account.location,'Bonfim');assert.equal(restored.lots.length,1);
  await send('DESVINCULAR');await send('CONFIRMO');assert.equal((await api('snapshot',undefined,linked.token)).status,401);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
