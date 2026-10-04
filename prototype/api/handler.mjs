let backend;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!process.env.DATABASE_URL){res.statusCode=503;return res.end(JSON.stringify({error:'PostgreSQL is awaiting configuration. No records were saved.'}));}
 try{
  const url=new URL(req.url,'https://localhost');
  const route=url.searchParams.get('route');
  if(!route||!(/^(companion\/[^?]+|webhooks\/twilio|healthz)$/.test(route))){res.statusCode=404;return res.end('Unknown route');}
  req.url='/'+route;
  backend||=import('../server.mjs').catch(e=>{backend=null;throw e;});
  const {requestHandler}=await backend;
  return await requestHandler(req,res);
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Backend unavailable. Retry with the same operation ID.'}));}
}
