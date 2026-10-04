export const STORAGE_SCHEMA=3;
const arrays=['lots','chat','choices','handovers','benchmarks','supportRequests','syncReceipts','documents','deliveryJobs'];
export function migrateState(value,defaults){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid saved state');
 const next={...defaults(),...structuredClone(value)};
 for(const field of arrays){if(next[field]===undefined)next[field]=[];if(!Array.isArray(next[field]))throw Error('Invalid saved '+field);}
 if(!next.session||typeof next.session!=='object'||Array.isArray(next.session))throw Error('Invalid saved conversation');
 next.session.draft||={};if(typeof next.session.draft!=='object'||Array.isArray(next.session.draft))throw Error('Invalid harvest draft');for(const field of arrays)if(next[field].some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Invalid saved record');if(next.shared?.pendingOperation&&next.shared.pendingRetry?.authorized&&next.shared.pendingRetry.status==='sending')next.shared.pendingRetry={...next.shared.pendingRetry,status:'awaiting-retry',nextAttemptAt:Date.now()};next.storageSchema=STORAGE_SCHEMA;return next;
}
export async function openPhoneStorage({defaults,onStatus=()=>{},legacy=globalThis.localStorage,indexedDB=globalThis.indexedDB,locks=globalThis.navigator?.locks}={}){
 let db,queue=Promise.resolve(),revision=0,writable=true,release;
 if(locks){await new Promise((resolve,reject)=>{locks.request('harvestlink-phone-writer',{ifAvailable:true},async lock=>{writable=!!lock;resolve();if(lock)await new Promise(r=>release=r);}).catch(reject);});}
 else writable=false; // No cross-tab exclusion: fail closed rather than risk overwriting records.
 let fallback;try{const raw=legacy?.getItem('harvestlink-v1');if(raw){try{fallback=migrateState(JSON.parse(raw),defaults);}catch{legacy?.setItem('harvestlink-corrupt-'+Date.now(),raw);onStatus('A damaged legacy backup was preserved.');}}}catch{onStatus('Browser backup storage unavailable.');}
 const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 if(indexedDB){try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('harvestlink-phone',STORAGE_SCHEMA);r.onupgradeneeded=()=>{for(const name of ['snapshots','quarantine'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>onStatus('Close older HarvestLink tabs to finish the storage upgrade.');});db.onversionchange=()=>{db.close();writable=false;onStatus('Storage upgraded in another tab. Reload this tab.');};}catch{onStatus('Transactional storage unavailable; browser backup only.');}}
 let state;
 if(db){const tx=db.transaction('snapshots','readonly'),store=tx.objectStore('snapshots');const current=await request(store.get('current'));
 if(current){revision=current.revision||0;try{state=migrateState(current.state,defaults);}catch{const backup=await request(db.transaction('snapshots','readonly').objectStore('snapshots').get('previous'));if(writable){const q=db.transaction('quarantine','readwrite');q.objectStore('quarantine').put(current,'damaged-'+Date.now());}try{state=backup?migrateState(backup.state,defaults):null;}catch{}onStatus('Recovered from a damaged snapshot; damaged data was preserved for review.');}}
 }
 state||=fallback||defaults();state=migrateState(state,defaults);
 const save=next=>{if(!writable)return Promise.reject(Error('This tab is read-only. Close the editing tab and reload to edit safely.'));const captured=migrateState(next,defaults);queue=queue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
 if(!db){try{legacy.setItem('harvestlink-v1',JSON.stringify(captured));onStatus('Saved in browser backup only; transactional storage unavailable.');resolve();}catch(e){reject(e);}return;}
 const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');let stale=false;const r=store.get('current');r.onsuccess=()=>{const current=r.result;if((current?.revision||0)!==revision){stale=true;tx.abort();return;}if(current)store.put(current,'previous');store.put({schema:STORAGE_SCHEMA,revision:revision+1,savedAt:new Date().toISOString(),state:captured},'current');};
 tx.oncomplete=()=>{revision++;try{legacy?.setItem('harvestlink-v1',JSON.stringify(captured));}catch{}onStatus('Saved transactionally on this phone.');resolve();};tx.onabort=()=>reject(Error(stale?'Another tab changed these records. Reload before editing.':'Phone storage write failed. Export your work before closing.'));tx.onerror=()=>{};
 }));return queue;};
 if(!writable)onStatus('Read-only tab: another tab owns editing, or this browser lacks safe tab locking.');
 return {state,save,flush:()=>queue,writable,transactional:!!db,close:()=>{release?.();db?.close();}};
}
