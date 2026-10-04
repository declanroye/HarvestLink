import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/handler.mjs';
import emailDrain from '../api/email-drain.mjs';
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}});
test('Vercel fails closed without PostgreSQL rather than acknowledging local writes',async()=>{
 const saved=process.env.DATABASE_URL;delete process.env.DATABASE_URL;const res=response();
 try{await handler({url:'/api/handler?route=companion/message',headers:{}},res);assert.equal(res.statusCode,503);assert.match(res.body,/No records were saved/);}finally{if(saved)process.env.DATABASE_URL=saved;}
});
test('email batches require configured scheduler authorization',async()=>{
 const saved=process.env.CRON_SECRET;process.env.CRON_SECRET='fixture';const res=response();
 try{await emailDrain({headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401);}finally{if(saved)process.env.CRON_SECRET=saved;else delete process.env.CRON_SECRET;}
});
