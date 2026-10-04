import {runConversation,conversationConfig,onlineContext,agentBypass} from './conversation.mjs';
import {processInbound,companionOperation,initialize,authenticateDevice,rateLimit} from './shared.mjs';
export async function processConversationalInbound(db,event,model,profile='general',env={},dependencies){
 initialize(db);if(db.seen[event.MessageSid])return db.seen[event.MessageSid];
 if(typeof event.Body!=='string'||event.Body.length>1000)return processInbound(db,event,model,profile);
 let session=db.sessions[event.From];if(session?.account&&db.accounts[session.account.id])session={...session,account:{...db.accounts[session.account.id]}};
 if(conversationConfig(env).enabled&&session&&!agentBypass(event.Body,session))rateLimit(db,'conversation:'+event.From,20);
 let proposal=null,failed=false;
 if(session)try{proposal=await runConversation(event.Body,session,model,onlineContext(db,session),conversationConfig(env),dependencies);}catch{failed=true;}
 const reply=processInbound(db,event,model,profile,Date.now(),proposal);
 if(failed){const en=session?.account?.language==='en';const suffix=en?'\nConversational AI is temporarily unavailable; I used the structured offline-capable assistant.':'\nIA conversacional indisponível; usei o assistente estruturado.';db.seen[event.MessageSid]=reply+suffix;return reply+suffix;}return reply;
}
export async function conversationalCompanionOperation(db,path,method,input,token,rateKey,model,env={},dependencies){
 if(path!=='conversation'||method!=='POST')return companionOperation(db,path,method,input,token,rateKey,model);
 const device=authenticateDevice(db,token),from=Object.keys(db.sessions).find(k=>db.sessions[k].account?.id===device.farmerId);
 const receipt=db.receipts['conversation:'+device.id+':'+input.operationId];
 if(receipt||!from||input.baseRevision!==db.accounts[device.farmerId].revision||typeof input.text!=='string'||input.text.length>1000)return companionOperation(db,path,method,input,token,rateKey,model);
 if(conversationConfig(env).enabled&&!agentBypass(input.text,db.sessions[from]))rateLimit(db,'conversation-device:'+device.id,20);
 let result=null;try{result=await runConversation(input.text,db.sessions[from],model,onlineContext(db,db.sessions[from]),conversationConfig(env),dependencies);}catch{}
 return companionOperation(db,path,method,input,token,rateKey,model,result);
}
