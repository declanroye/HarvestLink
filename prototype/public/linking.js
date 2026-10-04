import {scheduleRetry} from './outbox.js?release=v35';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export function installLinking({state,persist,render,toast,download,flush=async()=>{}}){
 let pairingPoll, pairingBusy=false,syncBusy=false;
 function startPairingPoll(){clearInterval(pairingPoll);pairingPoll=setInterval(()=>{if(!s.pairing||Date.now()>Date.parse(s.pairing.expiresAt)){clearInterval(pairingPoll);return;}if(navigator.onLine&&!pairingBusy)checkPairing(true);},6000);}
 const $=s=>document.querySelector(s);state.handovers||=[];state.shared||={};const s=state.shared; if(!s.kind){s.kind=(['localhost','127.0.0.1'].includes(location.hostname)||location.hostname.endsWith('.vercel.app'))?'node':'twilio';if(s.kind==='twilio')s.endpoint='https://harvestlink-test-9531.twil.io/harvestlink-companion';}
 $('#backend-url').value=s.endpoint||'';$('#backend-kind').value=s.kind||'node';
 function own(field,id=state.session.account?.id){return (state[field]||[]).filter(x=>field==='choices'?state.lots.some(l=>l.id===x.lotId&&l.farmerId===id):x.farmerId===id);}
 function payload(){const id=s.snapshot?.account.id;if(!id||state.session.account?.id!==id)throw Error('Activate your verified WhatsApp account first.');
  const a=state.session.account,b=s.snapshot.account,profileChanged=['name','location','language'].some(k=>a[k]!==b[k]);
  const changed=field=>own(field,id).filter(x=>canonical(x)!==canonical((s.snapshot[field]||[]).find(y=>y.id===x.id)));
  return {baseRevision:s.snapshot.revision,lots:changed('lots'),choices:changed('choices'),handovers:changed('handovers'),supportRequests:changed('supportRequests'),documents:changed('documents'),deliveryJobs:changed('deliveryJobs'),...(profileChanged?{account:{id,name:a.name,location:a.location,language:a.language}}:{})};
 }
 function dirty(){try{const p=payload();return !!(p.account||p.lots.length||p.choices.length||p.handovers.length||p.supportRequests.length||p.documents.length||p.deliveryJobs.length);}catch{return false;}}
 async function request(action,input={}){
  if(!navigator.onLine)throw Error('Offline. Your confirmed work remains on this phone.');
  const endpoint=s.endpoint||new URL('./companion/',location.href).href;
  const target=new URL(endpoint,location.href);
  if(target.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(target.hostname))throw Error('The shared service must use HTTPS.');
  let response;
  if(s.kind==='twilio')response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action,input:JSON.stringify(input),token:s.token||''}),cache:'no-store'});
  else{target.pathname=target.pathname.replace(/\/?$/,'/')+action;response=await fetch(target,{method:action==='snapshot'?'GET':'POST',headers:{'Content-Type':'application/json',...(s.token?{Authorization:'Bearer '+s.token}:{})},body:action==='snapshot'?undefined:JSON.stringify(input),cache:'no-store'});}
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Error('This address is not a shared backend. GitHub Pages serves only the companion; enter the deployed service URL.');}
  if(!response.ok)throw Object.assign(Error(data.error||'Shared service unavailable'),{status:response.status});return data;
 }
 function setSnapshot(snapshot){
  const id=snapshot.account.id;s.snapshot=structuredClone(snapshot);state.marketCache=structuredClone(snapshot.marketplace);state.session={...state.session,account:{...snapshot.account},demoMarketplace:snapshot.marketplace?.enabled,marketOrderId:snapshot.marketplace?.order?.id};
  for(const field of ['lots','choices','supportRequests','handovers','documents','deliveryJobs']){const old=own(field,id);state[field]||=[];state[field]=state[field].filter(x=>!old.some(y=>y.id===x.id));state[field].push(...structuredClone(snapshot[field]||[]));}
  persist();render();draw();
 }
 function draw(){
  $('#link-status').textContent=s.token?`Verified account: ${s.snapshot?.account.name||'pending'} · ${s.snapshot?.account.id.slice(0,8)||''}. ${s.snapshot?.account.id===state.session.account?.id?'Active on this phone.':'Review and activate below.'} ${dirty()?'Local changes await explicit submission.':'No unsent changes for this account.'}`:'No verified device link. Create a code, send it through WhatsApp, then confirm there.';
  $('#pairing-code').textContent=s.pairing?`${s.pairing.command} · expires ${s.pairing.expiresAt}`:'No active code.';
  $('#activate-linked').disabled=!s.token||s.snapshot?.account.id===state.session.account?.id;
  $('#farmer-sync').disabled=!s.token||!!s.review||s.snapshot?.account.id!==state.session.account?.id;
  $('#farmer-pull').disabled=!s.token;$('#unlink-device').disabled=!s.token;
  if(s.pendingRetry)$('#link-status').textContent+=' Submission: '+s.pendingRetry.status+' · attempt '+(s.pendingRetry.attempts||0);
  $('#shared-review').textContent=s.review?JSON.stringify(s.review,null,2):'No shared changes awaiting review.';
  $('#accept-shared').disabled=!s.review;
 }
 $('#save-backend').onclick=()=>{const endpoint=$('#backend-url').value.trim(),kind=$('#backend-kind').value;
  if(s.token&&(endpoint!==s.endpoint||kind!==s.kind))return toast('Unlink this device before changing its shared service.');
  try{if(endpoint){const u=new URL(endpoint,location.href);if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Use HTTPS for a public backend.');}s.endpoint=endpoint;s.kind=kind;persist();toast('Service address saved. No credentials or records sent.');}catch(e){toast(e.message);}
 };
 $('#request-link').onclick=async()=>{try{if(s.token)throw Error('This device already has a link. Revoke it before pairing another account.');clearInterval(pairingPoll);s.pairing=await request('link/request',{label:$('#link-device-name').value||'My phone',language:state.session.account?.language||$('#language').value||'en'});persist();draw();const number=(state.channel['whatsapp-number']||'+14155238886').replace(/^\+/,'');$('#send-link-whatsapp').href='https://wa.me/'+number+'?text='+encodeURIComponent(s.pairing.command);startPairingPoll();toast('Send the code from your WhatsApp, review the device name, then reply CONFIRM (English) or CONFIRMO (Português).');}catch(e){toast(e.message);}};
 async function checkPairing(quiet=false){if(pairingBusy)return;pairingBusy=true;try{if(!s.pairing)throw Error('Create a pairing code first.');const data=await request('link/claim',{id:s.pairing.id,claim:s.pairing.claim});if(data.state!=='linked')return quiet?undefined:toast('Waiting for confirmation in WhatsApp. Send the displayed command and code, then CONFIRM (English) or CONFIRMO (Português).');s.token=data.token;s.deviceId=data.deviceId;s.snapshot=data.snapshot;s.pairing=null;clearInterval(pairingPoll);persist();draw();toast('Phone ownership verified. Review the account and activate it below.');}catch(e){if(!quiet)toast(e.message);}finally{pairingBusy=false;}}
 $('#check-link').onclick=()=>checkPairing();
 if(s.pairing)startPairingPoll();
 $('#activate-linked').onclick=()=>{try{
  if(!s.token||!s.snapshot)throw Error('Complete WhatsApp verification first.');
  if(!$('#activate-confirm').checked)throw Error('Confirm that this is your WhatsApp account.');
  download('harvestlink-before-linking.json',state);
  const previousId=state.session.account?.id,local=own('lots',previousId),shouldImport=$('#import-local-confirm').checked;
  if(shouldImport&&own('choices',previousId).length)throw Error('Local choices need coordinator review. Activate without importing; the backup preserves them.');
  const copies=shouldImport?local.filter(l=>l.status!=='withdrawn').map(l=>({...l,id:crypto.randomUUID(),farmerId:s.snapshot.account.id,source:'offline-app',importedFrom:{lotId:l.id,accountId:previousId},ownershipConfirmedAt:new Date().toISOString()})):[];
  state.session={draft:{},account:{...s.snapshot.account},source:'offline-app'};setSnapshot(s.snapshot);state.lots.push(...copies);persist();render();draw();toast('Verified account activated. Local imports stay on this phone until you submit them.');
 }catch(e){toast(e.message);}};
 async function submitRecords(retry=false){if(syncBusy)return;syncBusy=true;try{
  if(!retry&&!$('#submit-records-confirm').checked)throw Error('Confirm submission of your account changes and confirmed records.');
  if(s.review)throw Error('Review the shared version before submitting again.');
  if(!s.pendingOperation){s.pendingOperation={...payload(),operationId:crypto.randomUUID()};s.pendingBaseline=canonical({account:state.session.account,lots:own('lots'),choices:own('choices'),handovers:own('handovers'),supportRequests:own('supportRequests'),documents:own('documents'),deliveryJobs:own('deliveryJobs')});}s.pendingRetry={...(s.pendingRetry||{}),status:'sending',authorized:true};await persist();await flush();
  const result=await request('sync',s.pendingOperation),current=canonical({account:state.session.account,lots:own('lots'),choices:own('choices'),handovers:own('handovers'),supportRequests:own('supportRequests')});
  if(s.pendingBaseline!==current){s.pendingOperation=null;s.pendingRetry=null;s.pendingBaseline=null;s.review=result.snapshot;persist();draw();return toast('Submitted records were received. Newer local work was preserved; review the shared version before continuing.');}
  s.pendingOperation=null;s.pendingRetry=null;s.pendingBaseline=null;s.review=null;
  setSnapshot(result.snapshot);state.syncReceipts.push({at:result.receivedAt,operationId:result.operationId,revision:result.revision,status:result.status,fingerprints:Object.fromEntries(own('lots').map(l=>[l.id,JSON.stringify(l)]))});persist();render();draw();$('#submit-records-confirm').checked=false;toast('Shared service received the records. No buyer acceptance or shipment authorization.');
 }catch(e){if(e.status===409){s.pendingOperation=null;s.pendingRetry=null;s.pendingBaseline=null;try{s.review=await request('snapshot');}catch{}persist();draw();}if(s.pendingOperation){s.pendingRetry=scheduleRetry({...s.pendingRetry,authorized:true},e);await persist();}toast(e.message);}finally{syncBusy=false;}}
 $('#farmer-sync').onclick=()=>submitRecords(false);
 const retryTimer=setInterval(()=>{if(s.pendingOperation&&s.pendingRetry?.authorized&&s.pendingRetry.status==='awaiting-retry'&&Date.now()>=s.pendingRetry.nextAttemptAt&&navigator.onLine&&!s.review)submitRecords(true);},1000);retryTimer?.unref?.();globalThis.addEventListener?.('pagehide',()=>clearInterval(retryTimer),{once:true});
 $('#farmer-pull').onclick=async()=>{try{const snapshot=await request('snapshot');if(dirty()||s.pendingOperation){s.review=snapshot;persist();draw();toast('Local changes exist. Review both versions; export before replacing local changes.');}else setSnapshot(snapshot);}catch(e){toast(e.message);}};
 $('#accept-shared').onclick=()=>{if(!$('#replace-local-confirm').checked)return toast('Confirm replacing this account’s local version after exporting a backup.');download('harvestlink-before-shared-review.json',state);const next=s.review;s.review=null;s.pendingOperation=null;state.session={draft:{},account:next.account,source:'offline-app'};setSnapshot(next);toast('Shared version restored. Previous local work is in your exported backup.');};
 $('#unlink-device').onclick=async()=>{try{await request('revoke');delete s.token;delete s.deviceId;delete s.snapshot;delete s.pairing;delete s.pendingOperation;persist();draw();toast('Server access revoked. Downloaded records remain on this phone.');}catch(e){toast(e.message);}};
 draw();return {refresh:draw,dirty,conversation:async(text,operationId)=>{if(dirty()||s.review||s.pendingOperation)throw Error('Submit or review your offline changes before using the shared assistant.');const result=await request('conversation',{text,operationId,baseRevision:s.snapshot.revision});setSnapshot(result.snapshot);state.session=structuredClone(result.session);persist();return result;},marketplace:async()=>{const data=await request('snapshot');return data.marketplace;}};
}
