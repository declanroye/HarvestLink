import {build} from 'esbuild';
const root=new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
for(const [entry,out] of [['offline-runtime-entry.mjs','offline-runtime.js'],['offline-worker-entry.mjs','offline-worker.js']])await build({entryPoints:[root+'scripts/'+entry],outfile:root+'public/ai/'+out,bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'eof'});
console.log('Bundled optional WebLLM runtime and worker. Model weights download only on user request.');
