import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialize} from '../shared.mjs';
import {documentText} from '../public/workflows.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const lists=['lots','choices','handovers','supportRequests','documents','deliveryJobs'];
export class PostgresStore {
 constructor(pool){this.pool=pool;}
 async migrate(){const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('harvestlink-schema'))");await c.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async health(){await this.pool.query('SELECT 1');}
 async transaction(route,operation){
  for(let attempt=0;attempt<4;attempt++){
   const client=await this.pool.connect();
   try{
    await client.query('BEGIN');await client.query("SET LOCAL lock_timeout = '5s'");await client.query("SET LOCAL statement_timeout = '15s'");
    let scope,control,initial;
    const controlNeeded=route.action==='link/request'||route.action==='link/claim';
    if(controlNeeded)control=(await client.query("SELECT payload FROM hl_control WHERE id='pairing' FOR UPDATE")).rows[0].payload;
    if(route.action==='link/request'){
     const data=initialize(structuredClone(control));const result=await operation(data);await client.query("UPDATE hl_control SET payload=$1 WHERE id='pairing'",[JSON.stringify({links:data.links,rateLimits:data.rateLimits})]);await client.query('COMMIT');return result;
    }
    if(route.from){scope='sender-'+hash(route.from);await client.query('INSERT INTO hl_accounts(scope) VALUES($1) ON CONFLICT DO NOTHING',[scope]);}
    else if(route.action==='link/claim'){
     const link=control.links?.[route.input.id];if(!link||!link.farmerId){const data=initialize(structuredClone(control));const result=await operation(data);await client.query('COMMIT');return result;}
     scope=(await client.query("SELECT scope FROM hl_identity WHERE kind='account' AND identity=$1",[link.farmerId])).rows[0]?.scope;
    }else scope=(await client.query("SELECT scope FROM hl_identity WHERE kind='device' AND identity=$1",[hash(route.token||'')])).rows[0]?.scope;
    if(!scope)throw Object.assign(Error('Link this device through WhatsApp first.'),{status:401});
    initial=(await client.query('SELECT payload FROM hl_accounts WHERE scope=$1 FOR UPDATE',[scope])).rows[0]?.payload;
    const data=initialize(structuredClone(initial||{}));
    if(route.from&&(/^\s*(link|vincular)\b/i.test(route.body||'')||data.sessions[route.from]?.pendingLinkId)){
     // Pairing is infrequent and serialized separately; normal farmer writes never take this lock.
     control=(await client.query("SELECT payload FROM hl_control WHERE id='pairing' FOR UPDATE")).rows[0].payload;
    }
    if(control)data.links=structuredClone(control.links||{});
    const records=(await client.query('SELECT kind,payload FROM hl_records WHERE scope=$1',[scope])).rows;
    for(const field of lists)data[field]=records.filter(r=>r.kind===field).map(r=>r.payload);
    const ownIds=new Set(data.lots.map(l=>l.id));
    // Current marketplace is illustrative; query an indexed, bounded matching pool instead of every account.
    const order=Object.values(data.sessions).find(s=>s.marketOrderId)?.marketOrderId;
    if(order){const {marketOrders}=await import('../public/marketplace.js');const o=marketOrders.find(x=>x.id===order);if(o){const matches=(await client.query("SELECT payload FROM hl_records WHERE kind='lots' AND scope<>$1 AND payload->>'crop'=$2 AND payload->>'grade'=$3 AND payload->>'location'=$4 AND payload->>'status'<>'withdrawn' ORDER BY id LIMIT 500",[scope,o.crop,o.grade,o.sourceLocation])).rows;data.lots.push(...matches.map(x=>x.payload));}}
    const result=await operation(data);
    const accountIds=new Set(Object.keys(data.accounts));
    for(const field of lists)for(const r of data[field]){const owner=field==='choices'?data.lots.find(l=>l.id===r.lotId)?.farmerId:r.farmerId;if(!accountIds.has(owner))continue;await client.query('INSERT INTO hl_records(kind,id,scope,payload) VALUES($1,$2,$3,$4) ON CONFLICT(kind,id) DO UPDATE SET payload=EXCLUDED.payload WHERE hl_records.scope=EXCLUDED.scope',[field,r.id,scope,JSON.stringify(r)]);}
    for(const j of data.deliveryJobs){if(!accountIds.has(j.farmerId)||!j.authorizedAt)continue;const d=data.documents.find(d=>d.id===j.documentId&&d.farmerId===j.farmerId);if(d)await client.query('INSERT INTO hl_email_jobs(id,scope,destination,subject,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[j.id,scope,j.destination,d.title,documentText(d)]);}
    for(const id of Object.keys(data.accounts))await client.query("INSERT INTO hl_identity(kind,identity,scope) VALUES('account',$1,$2) ON CONFLICT DO NOTHING",[id,scope]);
    for(const tokenHash of Object.keys(data.devices))await client.query("INSERT INTO hl_identity(kind,identity,scope) VALUES('device',$1,$2) ON CONFLICT DO NOTHING",[tokenHash,scope]);
    if(control)await client.query("UPDATE hl_control SET payload=$1 WHERE id='pairing'",[JSON.stringify({...control,links:data.links})]);
    const metadata={...data};for(const field of lists)delete metadata[field];metadata.links={};metadata.messages=[];const seen=Object.keys(metadata.seen);for(const k of seen.slice(0,-200))delete metadata.seen[k];
    await client.query('UPDATE hl_accounts SET payload=$2,updated_at=now() WHERE scope=$1',[scope,JSON.stringify(metadata)]);
    await client.query('COMMIT');return result;
   }catch(e){await client.query('ROLLBACK');if(['40P01','40001','55P03'].includes(e.code)&&attempt<3){await new Promise(r=>setTimeout(r,25*(attempt+1)));continue;}throw e;}finally{client.release();}
  }
 }
}
export async function createPostgresStore(url){const {Pool}=await import('pg');const store=new PostgresStore(new Pool({connectionString:url,max:Number(process.env.DB_POOL_SIZE||10)}));await store.migrate();return store;}
