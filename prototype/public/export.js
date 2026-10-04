export function exportJSON(data){return JSON.stringify(data,(key,value)=>['token','claim','claimHash','pairing'].includes(key)?undefined:value,2);}
