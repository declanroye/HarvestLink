import test from 'node:test';import assert from 'node:assert/strict';import {installLinking} from '../public/linking.js';import {exportJSON} from '../public/export.js';import {initialize,companionOperation} from '../shared.mjs';
const lot=(owner,kg=20)=>({id:crypto.randomUUID(),farmerId:owner,farmer:'Ana',location:'Boa Vista',crop:'cassava',quantityKg:kg,grade:'A',harvestDate:'2026-10-04',localPriceBrl:4,confirmedAt:new Date().toISOString(),confirmation:'explicit farmer confirmation',status:'available',source:'offline-app'});
function setup(){
 const verified={id:'verified-farmer',name:'Ana WhatsApp',location:'Boa Vista',language:'pt',revision:0},db=initialize({accounts:{[verified.id]:verified},sessions:{}}),token='a'.repeat(64);
 // The service authentication is real; the device fixture substitutes only prior phone verification.
 const originalFetch=globalThis.fetch;let resolveSync,wait=false;
 globalThis.location={href:'http://127.0.0.1:4173/'};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 const elements=new Map();globalThis.document={querySelector:s=>{if(!elements.has(s))elements.set(s,{value:'',checked:false,disabled:false,textContent:''});return elements.get(s);}};
 const $=s=>document.querySelector(s),state={session:{draft:{},account:{id:'local-farmer',name:'Ana',location:'Boa Vista',language:'pt'}},lots:[lot('local-farmer')],choices:[],supportRequests:[],syncReceipts:[],channel:{},shared:{}};
 const exported=[],toasts=[];
 globalThis.fetch=async(url,options)=>{const route=new URL(url).pathname.slice('/companion/'.length),input=options.body?JSON.parse(options.body):{};
  try{const data=companionOperation(db,route,options.method,input,options.headers.Authorization?.replace('Bearer ',''),'test-browser');if(route==='sync'&&wait)await new Promise(r=>resolveSync=r);return {ok:true,status:200,text:async()=>JSON.stringify(data)};}catch(e){return {ok:false,status:e.status||500,text:async()=>JSON.stringify({error:e.message})};}};
 installLinking({state,persist(){},render(){},toast:m=>toasts.push(m),download:(name,data)=>exported.push({name,data:JSON.parse(exportJSON(data))})});
 const pair=async()=>{await $('#request-link').onclick();const pending=db.links[state.shared.pairing.id];pending.state='confirmed';pending.farmerId=verified.id;await $('#check-link').onclick();};
 return {state,db,$,pair,exported,toasts,pause:()=>wait=true,resume:()=>resolveSync(),ready:()=>!!resolveSync,cleanup:()=>globalThis.fetch=originalFetch};
}
test('companion activation never merges by name and exports contain no access credentials',async()=>{
 const h=setup();try{await h.pair();assert.equal(h.state.session.account.id,'local-farmer');h.$('#activate-linked').onclick();assert.equal(h.state.session.account.id,'local-farmer');h.$('#activate-confirm').checked=true;h.$('#activate-linked').onclick();assert.equal(h.state.session.account.id,'verified-farmer');assert.equal(h.state.lots.length,1);assert.equal(h.state.lots[0].farmerId,'local-farmer');assert.equal(h.exported[0].data.shared.token,undefined);assert.ok(h.state.shared.token);assert.equal(h.$('#farmer-sync').disabled,false);}finally{h.cleanup();}
});
test('work created during an in-flight submission is preserved and requires explicit review',async()=>{
 const h=setup();try{await h.pair();h.$('#activate-confirm').checked=true;h.$('#activate-linked').onclick();h.state.lots.push(lot('verified-farmer',25));h.$('#submit-records-confirm').checked=true;h.pause();const submission=h.$('#farmer-sync').onclick();while(!h.ready())await new Promise(r=>setTimeout(r,1));h.state.lots.push(lot('verified-farmer',40));h.resume();await submission;assert.equal(h.db.lots.length,1);assert.equal(h.state.lots.filter(l=>l.farmerId==='verified-farmer').length,2);assert.ok(h.state.shared.review);assert.equal(h.$('#farmer-sync').disabled,true);h.$('#accept-shared').onclick();assert.equal(h.state.lots.filter(l=>l.farmerId==='verified-farmer').length,2);h.$('#replace-local-confirm').checked=true;h.$('#accept-shared').onclick();assert.equal(h.state.lots.filter(l=>l.farmerId==='verified-farmer').length,1);assert.equal(h.exported.at(-1).data.lots.filter(l=>l.farmerId==='verified-farmer').length,2);}finally{h.cleanup();}
});
test('evidence redaction removes nested claim and device tokens while retaining confirmed records',()=>{
 const result=JSON.parse(exportJSON({shared:{token:'secret-device',pairing:{claim:'secret-claim',code:'paircode'}},lots:[{id:'confirmed'}]}));assert.equal(result.shared.token,undefined);assert.equal(result.shared.pairing,undefined);assert.equal(result.lots[0].id,'confirmed');
});
