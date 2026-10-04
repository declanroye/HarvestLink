import {HarvestIntentModel} from './predict.mjs?release=v34';
export async function loadLocalModel(){
 const paths=['model/metadata.json','model/vocabulary.json','model/weights.f32','predict.mjs'];
 const responses=await Promise.all(paths.map(p=>fetch(new URL(p,import.meta.url))));
 if(responses.some(r=>!r.ok))throw Error('Small AI assets unavailable. Connect once to install the complete model.');
 const buffers=await Promise.all(responses.map(r=>r.arrayBuffer()));
 const decode=b=>JSON.parse(new TextDecoder().decode(b));
 const model=new HarvestIntentModel(decode(buffers[0]),decode(buffers[1]),buffers[2]);
 model.name='HarvestLink character-ngram logistic regression v1';
 model.assetSizes=Object.fromEntries(paths.map((p,i)=>[p,buffers[i].byteLength]));
 model.modelBytes=buffers.slice(0,3).reduce((s,b)=>s+b.byteLength,0);
 model.runtimeBytes=buffers[3].byteLength;
 return model;
}
