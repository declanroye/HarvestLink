import {HarvestIntentModel} from './predict.mjs?release=v37';
export async function loadLocalModel(){
 const paths=['model/metadata.json','model/vocabulary.json','model/weights.f32','predict.mjs'];
 const responses=await Promise.all(paths.map(p=>fetch(new URL(p,import.meta.url))));
 if(responses.some(r=>!r.ok))throw Error('Small AI assets unavailable. Connect once to install the complete model.');
 const buffers=await Promise.all(responses.map(r=>r.arrayBuffer()));
 const expected=["c6d9f5028517de4d9f7561b0349156649de0cac5562204631f3b2aca2c4dfca4","318c0eec974e56141888c3d14d923222ed7a6f69766340b6d4b50392b2205f50","da955911621494ea3f324b9511b0c5e2113747b07008e67ef0f6a7874eb978c5"];for(let i=0;i<3;i++){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffers[i]))).map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected[i])throw Error('Model integrity check failed. Reconnect to reinstall the offline model.');}
 const decode=b=>JSON.parse(new TextDecoder().decode(b));
 const model=new HarvestIntentModel(decode(buffers[0]),decode(buffers[1]),buffers[2]);
 model.name='HarvestLink character-ngram logistic regression v1';
 model.assetSizes=Object.fromEntries(paths.map((p,i)=>[p,buffers[i].byteLength]));
 model.modelBytes=buffers.slice(0,3).reduce((s,b)=>s+b.byteLength,0);
 model.runtimeBytes=buffers[3].byteLength;
 return model;
}
