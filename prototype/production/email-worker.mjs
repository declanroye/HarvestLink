import {createPostgresStore} from './postgres.mjs';
const store=await createPostgresStore(process.env.DATABASE_URL);
const relay=process.env.EMAIL_RELAY_URL,from=process.env.EMAIL_FROM,token=process.env.EMAIL_RELAY_TOKEN;
const configured=!!(relay&&from&&token&&process.env.EMAIL_RELAY_IDEMPOTENT==='true');
if(relay&&new URL(relay).protocol!=='https:')throw Error('Email relay must use HTTPS');
export async function processOne(){
 if(!configured)return false;
 const c=await store.pool.connect();let job;
 try{await c.query('BEGIN');job=(await c.query("SELECT * FROM hl_email_jobs WHERE ((status IN ('queued','retry') AND next_at<=now()) OR (status='sending' AND next_at<=now())) AND attempts<8 ORDER BY next_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!job){await c.query('COMMIT');return false;}await c.query("UPDATE hl_email_jobs SET status='sending',attempts=attempts+1,next_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1",[job.id]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 let status,error,receipt,next=0;
 try{const response=await fetch(relay,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'Idempotency-Key':job.id},body:JSON.stringify({from,to:job.destination,subject:job.subject,text:job.body,idempotencyKey:job.id}),signal:AbortSignal.timeout(15000)});if(!response.ok){const e=Object.assign(Error('Email relay returned HTTP '+response.status),{status:response.status});throw e;}const body=await response.json();if(typeof body.id!=='string'||!body.id)throw Error('Missing provider acceptance receipt');status='accepted-by-provider';receipt=body.id.slice(0,200);}catch(e){error=e.message;const retry=!e.status||e.status===429||e.status>=500;status=retry&&job.attempts<7?'retry':'failed-needs-review';next=Math.min(3600000,5000*2**job.attempts);}
 const c2=await store.pool.connect();try{await c2.query('BEGIN');await c2.query('UPDATE hl_email_jobs SET status=$2,provider_receipt=$3,last_error=$4,next_at=now()+($5*interval \'1 millisecond\'),updated_at=now() WHERE id=$1',[job.id,status,receipt||null,error||null,next]);await c2.query("UPDATE hl_records SET payload=payload||$2::jsonb WHERE kind='deliveryJobs' AND id=$1",[job.id,JSON.stringify({status,providerReceipt:receipt||null,lastError:error||null,attempts:job.attempts+1})]);await c2.query('COMMIT');}catch(e){await c2.query('ROLLBACK');throw e;}finally{c2.release();}return true;
}
if(!process.env.VERCEL){
console.log(configured?'Email worker ready; acceptance is not delivery confirmation.':'Email worker waiting for configured HTTPS relay, sender, token and idempotency guarantee. Nothing will be sent.');
let stopped=false;process.on('SIGTERM',()=>stopped=true);process.on('SIGINT',()=>stopped=true);
while(!stopped){try{if(!await processOne())await new Promise(r=>setTimeout(r,5000));}catch(e){console.error('Delivery worker failed:',e.code||'runtime');await new Promise(r=>setTimeout(r,5000));}}await store.pool.end();

}
