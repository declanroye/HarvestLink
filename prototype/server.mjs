import {handleFarmerMessage} from './public/account.js';
import http from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {timingSafeEqual,randomUUID} from 'node:crypto';
import {handleMessage,validateLot,profiles,demoOrder} from './public/core.js';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1',dataPath=path.join(process.env.DATA_DIR||path.join(root,'data'),'messages.json');
const model=JSON.parse(await readFile(path.join(root,'public/model.json'),'utf8'));
let db={sessions:{},lots:[],choices:[],handovers:[],messages:[],seen:{}};try{db=JSON.parse(await readFile(dataPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
let twilio;try{twilio=(await import('twilio')).default;}catch{}
const configured=!!(twilio&&process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM&&process.env.PUBLIC_WEBHOOK_URL);
let queue=Promise.resolve();const transaction=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function save(){await mkdir(path.dirname(dataPath),{recursive:true});await writeFile(dataPath,JSON.stringify(db,null,2));}
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
const xml=s=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Body too large');}return raw;}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/webhooks/twilio'&&req.method==='POST'){
  if(!configured)return json(res,503,{error:'Twilio not configured'});
  const params=Object.fromEntries(new URLSearchParams(await body(req)));
  if(!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN,req.headers['x-twilio-signature']||'',process.env.PUBLIC_WEBHOOK_URL,params))return json(res,403,{error:'Invalid provider signature'});
  if(!params.MessageSid||!params.From||typeof params.Body!=='string')return json(res,400,{error:'Missing provider fields'});
  const reply=await transaction(async()=>{if(db.seen[params.MessageSid])return db.seen[params.MessageSid];const id=params.From,session=db.sessions[id]||{draft:{},source:'twilio-inbound'},result=handleFarmerMessage(params.Body,session,model,{lots:db.lots,choices:db.choices,profile:process.env.HARVESTLINK_PROFILE==='bonfim'?profiles.bonfim:profiles.general,order:process.env.HARVESTLINK_PROFILE==='bonfim'?demoOrder:null});db.sessions[id]=result.session;if(result.lotUpdate)db.lots=db.lots.map(l=>l.id===result.lotUpdate.id?{...l,...result.lotUpdate}:l);if(result.supportRequest)db.supportRequests=(db.supportRequests||[]).concat(result.supportRequest);if(result.choice)db.choices.push(result.choice);if(result.lot)db.lots.push({...result.lot,providerSid:params.MessageSid});db.messages.push({kind:'verified-inbound',sid:params.MessageSid,from:id,body:params.Body,reply:result.reply,at:new Date().toISOString(),signatureVerified:true});db.seen[params.MessageSid]=result.reply;await save();return result.reply;});
  res.writeHead(200,{'Content-Type':'text/xml'});return res.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(reply)}</Message></Response>`);
 }
 if(url.pathname.startsWith('/api/')){
  if(!process.env.OPERATOR_API_KEY||!equal(req.headers.authorization,'Bearer '+process.env.OPERATOR_API_KEY))return json(res,401,{error:'Operator key required'});
  if(url.pathname==='/api/messages'&&req.method==='GET')return json(res,200,{configured,messages:db.messages,lots:db.lots,accounts:Object.values(db.sessions).map(s=>s.account).filter(Boolean),supportRequests:db.supportRequests||[]});
  if(url.pathname==='/api/sync'&&req.method==='POST'){
   const payload=JSON.parse(await body(req));if(!Array.isArray(payload.lots)||payload.lots.length>500)throw Error('Invalid lots');
   for(const l of payload.lots){validateLot(l);if(!l.id||!l.confirmedAt)throw Error('Only confirmed lots accepted');}
   for(const field of ['choices','handovers'])if(!Array.isArray(payload[field])||payload[field].length>500)throw Error('Invalid '+field);
   const conflicts=await transaction(async()=>{const conflicts=[];for(const field of ['lots','choices','handovers'])for(const item of payload[field]){const existing=db[field].find(x=>x.id===item.id);if(existing&&canonical(existing)!==canonical(item))conflicts.push({type:field,id:item.id});}if(conflicts.length)return conflicts;for(const field of ['lots','choices','handovers'])for(const item of payload[field])if(item.id&&!db[field].some(x=>x.id===item.id))db[field].push(item);await save();return [];});if(conflicts.length)return json(res,409,{error:'Existing records differ. Review the conflict with the coordinator; nothing was uploaded.',conflicts});return json(res,200,{lots:db.lots.length});
  }
  if(url.pathname==='/api/send'&&req.method==='POST'){
   if(!configured)return json(res,503,{error:'Configure Twilio credentials, sender and public webhook first'});
   const input=JSON.parse(await body(req));const allowed=(process.env.TEST_RECIPIENTS||'').split(',');if(!allowed.includes(input.to))return json(res,403,{error:'Recipient must be on server TEST_RECIPIENTS consent allowlist'});
   if(typeof input.body!=='string'||!input.body.trim()||input.body.length>1000)throw Error('Invalid message');
   const client=twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN),message=await client.messages.create({to:input.to,from:process.env.TWILIO_FROM,body:input.body});
   await transaction(async()=>{db.messages.push({kind:'provider-outbound',sid:message.sid,status:message.status,to:input.to,body:input.body,at:new Date().toISOString()});await save();});return json(res,200,{sid:message.sid,status:message.status});
  }
  return json(res,404,{error:'Unknown API route'});
 }
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 const pathname=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname),file=path.resolve(root,'public','.'+pathname),publicRoot=path.join(root,'public')+path.sep;
 if(!file.startsWith(publicRoot))return json(res,403,{error:'Invalid path'});
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(bytes);
 }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:400,{error:e.message});else res.end();}});
server.listen(port,host,()=>console.log(`HarvestLink: http://${host}:${port} | Twilio ${configured?'configured':'not configured'}`));
