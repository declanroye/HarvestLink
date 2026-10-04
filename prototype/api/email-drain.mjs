import {timingSafeEqual} from 'node:crypto';
let worker;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+(process.env.CRON_SECRET||''));
 if(!process.env.CRON_SECRET||actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.statusCode=401;return res.end('Unauthorized');}
 if(!process.env.DATABASE_URL){res.statusCode=503;return res.end('Database awaiting configuration');}
 try{
  worker||=import('../production/email-worker.mjs').catch(e=>{worker=null;throw e;});
  const {processOne}=await worker;let processed=0;
  while(processed<2&&await processOne())processed++;
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({processed,note:'Provider acceptance is not delivery confirmation. Unconfigured jobs remain queued.'}));
 }catch{res.statusCode=503;res.end('Delivery batch unavailable; durable jobs retained');}
}
