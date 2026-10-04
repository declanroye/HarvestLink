import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import twilio from 'twilio';
test('official SDK webhook signatures, missing-field dialogue, duplicate SID idempotency and operator authentication',async()=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'harvestlink-test-')),port=4187,url=`http://127.0.0.1:${port}/webhooks/twilio`,token='synthetic-test-token',key='synthetic-operator-key';
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,TWILIO_ACCOUNT_SID:'AC'+'0'.repeat(32),TWILIO_AUTH_TOKEN:token,TWILIO_FROM:'+15005550006',PUBLIC_WEBHOOK_URL:url,OPERATOR_API_KEY:key}});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);child.stdout.on('data',d=>{if(d.toString().includes('HarvestLink:')){clearTimeout(timer);resolve();}});child.on('exit',c=>reject(Error('Server exit '+c)));});
  const send=async(body,sid,valid=true)=>{const params={From:'+15005550009',To:'+15005550006',Body:body,MessageSid:sid};return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':valid?twilio.getExpectedTwilioSignature(token,url,params):'invalid'},body:new URLSearchParams(params)});};
  assert.equal((await send('teste','SM-invalid',false)).status,403);
  for(const [i,message] of ['INICIAR','ACEITO','Ana','Boa Vista','PT','CONFIRMO'].entries())assert.equal((await send(message,'SM-onboard-'+i)).status,200);
  let r=await send('Sou Ana, tenho 120 kg de mandioca, em Boa Vista, classe A','SM-1');assert.match(await r.text(),/data da colheita/);
  r=await send('2026-10-04, R$ 3,50/kg','SM-2');assert.match(await r.text(),/CONFIRMO/);
  r=await send('CONFIRMO','SM-3');const reply=await r.text();assert.match(reply,/Lote confirmado/);assert.equal(await (await send('CONFIRMO','SM-3')).text(),reply);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/messages`)).status,401);
  const db=await (await fetch(`http://127.0.0.1:${port}/api/messages`,{headers:{Authorization:'Bearer '+key}})).json();assert.equal(db.lots.length,1);assert.equal(db.messages.length,9);assert.equal(db.messages.every(m=>m.signatureVerified),true);
  const sync=payload=>fetch('http://127.0.0.1:'+port+'/api/sync',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await sync({lots:db.lots,choices:[],handovers:[]})).status,200);
  assert.equal((await sync({lots:[{...db.lots[0],status:'withdrawn'}],choices:[],handovers:[]})).status,409);
  const unchanged=await (await fetch('http://127.0.0.1:'+port+'/api/messages',{headers:{Authorization:'Bearer '+key}})).json();assert.equal(unchanged.lots[0].status,'available');
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/send`,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({to:'+unapproved',body:'test'})})).status,403);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(dataDir,{recursive:true,force:true});}
});
