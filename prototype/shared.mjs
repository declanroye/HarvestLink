import {marketView,marketOrder,marketPoolLots} from './public/marketplace.js';
import {englishReply} from './public/conversation-language.js';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {handleFarmerMessage} from './public/account.js';
import {validateLot,profiles,demoOrder,demoCosts} from './public/core.js';
const digest=s=>createHash('sha256').update(s).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function initialize(db){
 for(const name of ['sessions','accounts','links','devices','seen','receipts','rateLimits'])db[name]||={};
 for(const name of ['lots','choices','handovers','messages','supportRequests','documents','deliveryJobs'])db[name]||=[];
 for(const session of Object.values(db.sessions))if(session.account&&!db.accounts[session.account.id])db.accounts[session.account.id]={...session.account,revision:0};
 return db;
}
function prune(db,now){for(const [key,link] of Object.entries(db.links))if(now>link.expiresAt+3600000)delete db.links[key];for(const [key,r] of Object.entries(db.rateLimits))if(now-r.at>3600000)delete db.rateLimits[key];}
export function rateLimit(db,key,max=15,now=Date.now()){
 prune(db,now);const r=db.rateLimits[key];if(!r||now-r.at>60000)db.rateLimits[key]={at:now,count:1};else if(++r.count>max)fail(429,'Too many attempts. Wait one minute.');
}
export function requestLink(db,label='My phone',now=Date.now(),language='pt'){
 initialize(db);prune(db,now);
 if(Object.keys(db.links).length>=25)fail(429,'Pairing service busy. Try again later.');
 const id=secret(),claim=secret();let code;do{code=randomBytes(6).toString('base64url').toUpperCase().replace(/[-_]/g,'X').slice(0,8);}while(Object.values(db.links).some(l=>l.code===code));
 db.links[id]={id,code,claimHash:digest(claim),label:String(label).replace(/[\r\n]/g,' ').slice(0,40),expiresAt:now+600000,state:'pending'};
 return {id,claim,code,expiresAt:new Date(now+600000).toISOString(),command:(language==='en'?'LINK ':'VINCULAR ')+code};
}
export function claimLink(db,id,claim,now=Date.now()){
 initialize(db);const link=db.links[id];
 if(!link||typeof claim!=='string'||digest(claim)!==link.claimHash)fail(401,'Invalid pairing claim');
 if(now>link.expiresAt)fail(410,'Pairing expired. Create a new code.');
 if(link.state!=='confirmed')return {state:link.state};
 // Claim is single use. Only hashes of device credentials are stored.
 const token=secret(),deviceId=secret();db.devices[digest(token)]={id:deviceId,farmerId:link.farmerId,createdAt:new Date(now).toISOString(),label:link.label,revoked:false};
 link.state='claimed';delete link.claimHash;return {state:'linked',token,deviceId,snapshot:snapshot(db,link.farmerId)};
}
export function authenticateDevice(db,token){
 if(typeof token!=='string'||token.length!==64)fail(401,'Link this device through WhatsApp first.');
 const device=db.devices[digest(token)];if(!device||device.revoked)fail(401,'Device access expired or revoked. Link again.');return device;
}
export function snapshot(db,farmerId){
 const account=db.accounts[farmerId];if(!account)fail(404,'Account not found');
 const lots=db.lots.filter(l=>l.farmerId===farmerId),ids=new Set(lots.map(l=>l.id));
 const session=Object.values(db.sessions).find(s=>s.account?.id===farmerId)||{account};
 return {documents:structuredClone(db.documents.filter(d=>d.farmerId===farmerId)),deliveryJobs:structuredClone(db.deliveryJobs.filter(d=>d.farmerId===farmerId)),marketplace:marketView(session,db.lots,db.choices,db.handovers),account:{...account},revision:account.revision,handovers:structuredClone(db.handovers.filter(h=>h.farmerId===farmerId)),lots:structuredClone(lots),choices:structuredClone(db.choices.filter(c=>ids.has(c.lotId))),supportRequests:structuredClone(db.supportRequests.filter(s=>s.farmerId===farmerId)),shipmentStatus:'awaiting buyer confirmation and trade-requirement checks'};
}
function bump(db,id){if(db.accounts[id])db.accounts[id].revision=(db.accounts[id].revision||0)+1;}
export function processInbound(db,event,model,profileName='general',now=Date.now()){
 initialize(db);if(db.seen[event.MessageSid])return db.seen[event.MessageSid];if(typeof event.Body!=='string'||event.Body.length>1000)fail(400,'Send a message of up to 1,000 characters.');rateLimit(db,'inbound:'+event.From,60);
 let session=db.sessions[event.From]||{draft:{},source:'twilio-inbound'};
 if(session.account&&db.accounts[session.account.id])session={...session,account:{...db.accounts[session.account.id]}};
 const t=event.Body.trim().toLowerCase();let result;
 if(/^vincular\b|^link\b/.test(t)){
  rateLimit(db,'link:'+event.From,6,now);const code=t.split(/\s+/)[1]?.toUpperCase();
  const link=Object.values(db.links).find(l=>l.code===code&&l.state==='pending'&&l.expiresAt>now);
  if(!session.account)result={session,reply:'Crie seu perfil primeiro: INICIAR. Depois envie VINCULAR e o código novamente.'};
  else if(!link)result={session,reply:'Código inválido, expirado ou já utilizado. Gere outro no telefone.'};
  else if(link.candidateFrom&&link.candidateFrom!==event.From)result={session,reply:'Código em revisão por outro número. Gere um novo código.'};
  else{link.candidateFrom=event.From;result={session:{...session,pendingLinkId:link.id},reply:`Vincular o dispositivo "${link.label}" à conta ${session.account.name}? Código ${link.code}. Ele poderá consultar e enviar seus registros. Digite CONFIRMO somente se você criou este código, ou CANCELAR.`};}
 }else if(session.pendingLinkId){
  const link=db.links[session.pendingLinkId];
  if(t==='cancelar'||t==='cancel'){if(link?.candidateFrom===event.From)link.candidateFrom=null;result={session:{...session,pendingLinkId:null},reply:'Vinculação cancelada.'};}
  else if(!link||link.expiresAt<now||link.state!=='pending'||link.candidateFrom!==event.From)result={session:{...session,pendingLinkId:null},reply:'Código expirado ou já usado. Gere outro no telefone.'};
  else if(t!=='confirmo'&&t!=='confirm')result={session,reply:'Confira o dispositivo e responda CONFIRMO ou CANCELAR.'};
  else{link.state='confirmed';link.farmerId=session.account.id;link.verifiedFrom=event.From;link.confirmedAt=new Date(now).toISOString();result={session:{...session,pendingLinkId:null},reply:'Número verificado e vinculação confirmada. Volte ao telefone e toque Verificar vínculo. Nenhuma venda foi confirmada.'};}
 }else if(/^(desvincular|unlink devices)$/.test(t)){
  result={session:{...session,pendingUnlink:true},reply:'Revogar o acesso de todos os dispositivos desta conta? Digite CONFIRMO ou CANCELAR.'};
 }else if(session.pendingUnlink){
  if(t==='confirmo'||t==='confirm'){for(const d of Object.values(db.devices))if(d.farmerId===session.account?.id)d.revoked=true;result={session:{...session,pendingUnlink:null},reply:'Acesso dos dispositivos revogado. Registros locais já baixados continuam no telefone.'};}
  else if(t==='cancelar'||t==='cancel')result={session:{...session,pendingUnlink:null},reply:'Revogação cancelada.'};else result={session,reply:'Digite CONFIRMO ou CANCELAR.'};
 }else{
  const profile=profiles[profileName]||profiles.general;
  const order=marketOrder(session);const lots=order?marketPoolLots(db.lots,order):db.lots;
 result=handleFarmerMessage(event.Body,session,model,{lots,choices:db.choices,handovers:db.handovers,documents:db.documents,deliveryJobs:db.deliveryJobs,costs:demoCosts,profile,order:order||(profile.id==='bonfim'?demoOrder:null)});
 }
 if(result.session.account?.language==='en'){result.reply=englishReply(result.reply).replace(/^Vincular o dispositivo/, 'Link device').replace('à conta','to account').replace('? Código','? Code').replace('Ele poderá consultar e enviar seus registros. Digite CONFIRM somente se você criou este código, ou CANCEL.','It can read and submit your records. Reply CONFIRM only if you created this code, or CANCEL.');}
 db.sessions[event.From]=result.session;
 if(result.session.account){const id=result.session.account.id,old=db.accounts[id],account={...result.session.account,revision:old?.revision||0};db.accounts[id]=account;
  if(!old||canonical({...old,revision:0})!==canonical({...account,revision:0})||result.lot||result.choice||result.lotUpdate||result.supportRequest)bump(db,id);
  db.sessions[event.From].account={...db.accounts[id]};
 }
 if(result.lot)db.lots.push({...result.lot,providerSid:event.MessageSid});
 if(result.choice)db.choices.push(result.choice);
 if(result.lotUpdate)db.lots=db.lots.map(l=>l.id===result.lotUpdate.id?{...l,...result.lotUpdate}:l);
 if(result.supportRequest)db.supportRequests.push(result.supportRequest);
 if(result.document){db.documents.push(result.document);bump(db,result.session.account.id);}
 if(result.deliveryJob){db.deliveryJobs.push(result.deliveryJob);bump(db,result.session.account.id);}
 if(result.handover){db.handovers.push(result.handover);bump(db,result.session.account.id);}
 db.seen[event.MessageSid]=result.reply;return result.reply;
}
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{4,80}$/.test(id);
function confirmedDate(s){return typeof s==='string'&&Number.isFinite(Date.parse(s));}
export function syncDevice(db,device,payload){
 const id=device.farmerId,receiptKey=device.id+':'+payload.operationId;
 if(!validId(payload.operationId))fail(400,'Invalid operation ID');
 const inputHash=digest(canonical(payload));if(db.receipts[receiptKey]){const r=db.receipts[receiptKey];if(r.inputHash!==inputHash)fail(409,'Operation ID already used with different content');return {...r.result,snapshot:snapshot(db,id)};}
 const current=snapshot(db,id);if(payload.baseRevision!==current.revision)fail(409,'WhatsApp records changed. Review the shared version before resubmitting.');
 for(const field of ['lots','choices','supportRequests'])if(!Array.isArray(payload[field])||payload[field].length>100)fail(400,'Invalid '+field);
 // Validate the complete batch before mutating any durable record.
 const merged=new Map(current.lots.map(l=>[l.id,l]));const lotChanges=[];
 for(const input of payload.lots){
  validateLot(input);if(!validId(input.id)||input.farmerId!==id||!confirmedDate(input.confirmedAt)||input.confirmation!=='explicit farmer confirmation'||!['available','withdrawn'].includes(input.status))fail(400,'Only your explicitly confirmed lots are accepted');
  const existing=db.lots.find(l=>l.id===input.id);if(existing&&existing.farmerId!==id)fail(403,'Lot belongs to another account');
  if(existing){const comparable={...input};if(existing.providerSid)comparable.providerSid=existing.providerSid;
   const immutable=x=>{const {status,withdrawnAt,providerSid,...rest}=x;return rest;};
   if(canonical(immutable(existing))!==canonical(immutable(comparable)))fail(409,'Confirmed lot facts cannot be overwritten. Ask the coordinator for a correction.');
   if(existing.status==='withdrawn'&&input.status!=='withdrawn')fail(409,'Withdrawn lots cannot be reopened');
   if(input.status==='withdrawn'&&(existing.reservedOrderId||db.choices.some(c=>c.lotId===input.id)||payload.choices.some(c=>c.lotId===input.id)))fail(409,'A reserved or chosen lot requires coordinator review');
   if(input.status==='withdrawn'&&!confirmedDate(input.withdrawnAt))fail(400,'Withdrawal confirmation time required');
   const next={...existing,status:input.status,...(input.withdrawnAt?{withdrawnAt:input.withdrawnAt}:{})};lotChanges.push(next);merged.set(next.id,next);
  }else{if(input.reservedOrderId)fail(400,'A phone cannot assign order reservations');const next={...input,source:'verified-linked-companion'};lotChanges.push(next);merged.set(next.id,next);}
 }
 for(const choice of payload.choices){
  const lot=merged.get(choice.lotId);if(!lot||lot.status==='withdrawn'||!validId(choice.id)||choice.humanConfirmed!==true||!confirmedDate(choice.createdAt)||!['local','cross-border-proposal'].includes(choice.choice)||!Number.isFinite(choice.quantityKg)||choice.quantityKg<=0||choice.quantityKg>lot.quantityKg||choice.status!=='awaiting buyer confirmation and trade-requirement checks')fail(400,'Invalid farmer choice');
  const old=db.choices.find(c=>c.id===choice.id);if(old&&canonical(old)!==canonical(choice))fail(409,'Choice differs from existing record');
  if(db.choices.some(c=>c.lotId===choice.lotId&&c.id!==choice.id)||payload.choices.some(c=>c.lotId===choice.lotId&&c.id!==choice.id))fail(409,'A choice already exists for this lot');
 }
 for(const r of payload.supportRequests){if(!validId(r.id)||r.farmerId!==id||r.status!=='pending'||!confirmedDate(r.createdAt))fail(400,'Invalid support request');const old=db.supportRequests.find(x=>x.id===r.id);if(old&&canonical(old)!==canonical(r))fail(409,'Support request conflict');}
 const handovers=payload.handovers||[];
 if(!Array.isArray(handovers)||handovers.length>50)fail(400,'Invalid handovers');
 for(const h of handovers){const choice=[...db.choices,...payload.choices].find(c=>c.id===h.choiceId),lot=choice&&merged.get(choice.lotId);
 if(!validId(h.id)||h.farmerId!==id||h.humanConfirmed!==true||!confirmedDate(h.createdAt)||!lot||lot.farmerId!==id||choice.choice!=='cross-border-proposal'||h.orderId!==choice.orderId||h.quantityKg!==choice.quantityKg||h.dispatchAuthorized!==false||h.status!=='awaiting buyer confirmation and trade-requirement checks'||h.demo!==true||typeof h.exporter!=='string'||h.exporter.length>100||h.transport?.booking!=='not booked'||!h.checks||Object.values(h.checks).some(v=>!['pending','unchecked','unconfirmed'].includes(v)))fail(400,'Only your reviewed pending demo handover is accepted');
 const old=db.handovers.find(x=>x.id===h.id);if(old&&canonical(old)!==canonical(h))fail(409,'Handover conflict');
 }
 const documents=payload.documents||[],deliveryJobs=payload.deliveryJobs||[];
 if(!Array.isArray(documents)||documents.length>50||!Array.isArray(deliveryJobs)||deliveryJobs.length>50)fail(400,'Invalid workflow batch');
 for(const d of documents){const lot=merged.get(d.record?.lotId);if(!validId(d.id)||d.farmerId!==id||d.humanConfirmed!==true||d.status!=='draft-for-review'||!confirmedDate(d.createdAt)||!['harvest-summary','packing-list','proforma-invoice'].includes(d.kind)||!lot||lot.farmerId!==id||d.record.quantityKg!==lot.quantityKg||d.record.grade!==lot.grade||d.record.harvestDate!==lot.harvestDate||d.record.location!==lot.location||d.record.localPriceBrl!==lot.localPriceBrl||typeof d.title!=='string'||d.title.length>80||d.packaging&&(!/^\d{1,4}\s+.{2,60}$/.test(d.packaging)))fail(400,'Document must reference your confirmed harvest');const old=db.documents.find(x=>x.id===d.id);if(old&&canonical(old)!==canonical(d))fail(409,'Document conflict');}
 for(const j of deliveryJobs){const d=[...db.documents,...documents].find(x=>x.id===j.documentId&&x.farmerId===id);if(!validId(j.id)||j.farmerId!==id||!d||j.channel!=='email'||!confirmedDate(j.authorizedAt)||!['saved-on-phone','awaiting-provider-configuration'].includes(j.status)||typeof j.destination!=='string'||! /^[^\s@\r\n]{1,64}@[^\s@\r\n]{1,190}\.[a-zA-Z]{2,20}$/.test(j.destination))fail(400,'Invalid reviewed delivery request');const old=db.deliveryJobs.find(x=>x.id===j.id);if(old&&canonical(old)!==canonical(j))fail(409,'Delivery conflict');}
 let account=current.account;
 if(payload.account){const a=payload.account;if(a.id!==id||typeof a.name!=='string'||a.name.trim().length<2||a.name.length>60||typeof a.location!=='string'||a.location.length<2||a.location.length>60||!['pt','en'].includes(a.language))fail(400,'Invalid profile');account={...account,name:a.name,location:a.location,language:a.language,updatedAt:new Date().toISOString()};}
 for(const l of lotChanges){const at=db.lots.findIndex(x=>x.id===l.id);if(at<0)db.lots.push(l);else db.lots[at]=l;}
 for(const field of ['choices','supportRequests'])for(const item of payload[field])if(!db[field].some(x=>x.id===item.id))db[field].push(structuredClone(item));
 for(const h of handovers)if(!db.handovers.some(x=>x.id===h.id))db.handovers.push(structuredClone(h));
 for(const d of documents)if(!db.documents.some(x=>x.id===d.id))db.documents.push(structuredClone(d));
 for(const j of deliveryJobs)if(!db.deliveryJobs.some(x=>x.id===j.id))db.deliveryJobs.push({...structuredClone(j),status:'awaiting-provider-configuration'});
 db.accounts[id]=account;bump(db,id);
 const result={operationId:payload.operationId,receivedAt:new Date().toISOString(),revision:db.accounts[id].revision,status:'received by shared service; not buyer acceptance'};
 db.receipts[receiptKey]={inputHash,result};const keys=Object.keys(db.receipts);for(const k of keys.slice(0,-200))delete db.receipts[k];
 return {...result,snapshot:snapshot(db,id)};
}
export function companionOperation(db,path,method,input,token,rateKey='unknown',model){
 initialize(db);
 if(path==='link/request'&&method==='POST'){rateLimit(db,'request:'+rateKey,5);return requestLink(db,input.label,Date.now(),input.language);}
 if(path==='link/claim'&&method==='POST'){rateLimit(db,'claim:'+rateKey,40);return claimLink(db,input.id,input.claim);}
 const device=authenticateDevice(db,token);rateLimit(db,'device:'+device.id,120);
 if(path==='conversation'&&method==='POST'){
  if(!model)fail(503,'Conversation model unavailable');
  if(!validId(input.operationId)||typeof input.text!=='string'||!input.text.trim()||input.text.length>1000)fail(400,'Invalid conversation message');
  const key='conversation:'+device.id+':'+input.operationId,hash=digest(canonical(input));
  const previous=db.receipts[key];if(previous){if(previous.inputHash!==hash)fail(409,'Message ID already used with different content');return {...previous.result,session:structuredClone(db.sessions[Object.keys(db.sessions).find(k=>db.sessions[k].account?.id===device.farmerId)]),snapshot:snapshot(db,device.farmerId)};}
  if(input.baseRevision!==db.accounts[device.farmerId].revision)fail(409,'Shared account changed. Refresh before sending this message.');
  const from=Object.keys(db.sessions).find(k=>db.sessions[k].account?.id===device.farmerId);
  if(!from)fail(409,'Messaging account session unavailable');
  const reply=processInbound(db,{From:from,Body:input.text,MessageSid:key},model);
  bump(db,device.farmerId);db.sessions[from].account={...db.accounts[device.farmerId]};
  const result={reply,session:structuredClone(db.sessions[from]),snapshot:snapshot(db,device.farmerId),operationId:input.operationId};
  db.receipts[key]={inputHash:hash,result:{reply,operationId:input.operationId}};for(const k of Object.keys(db.receipts).slice(0,-40))delete db.receipts[k];
  return result;
 }
 if(path==='snapshot'&&method==='GET')return snapshot(db,device.farmerId);
 if(path==='sync'&&method==='POST')return syncDevice(db,device,input);
 if(path==='revoke'&&method==='POST'){device.revoked=true;return {revoked:true};}
 fail(404,'Unknown companion route');
}

// SMS providers limit a TwiML Message body. Preserve all reviewed text in bounded parts.
export function channelReplyParts(text,from){
 text=String(text);if(String(from).startsWith('whatsapp:'))return [text];
 const chunks=[];while(text.length){let end=Math.min(1300,text.length);if(end<text.length){const boundary=text.lastIndexOf(' ',end);if(boundary>650)end=boundary;}chunks.push(text.slice(0,end).trim());text=text.slice(end).trimStart();}
 return chunks.length>1?chunks.map((part,i)=>'('+ (i+1)+'/'+chunks.length+') '+part):chunks;
}
