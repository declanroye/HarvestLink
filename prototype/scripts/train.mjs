import {writeFile,mkdir} from 'node:fs/promises';
import {tokens} from '../public/core.js';
const examples={
 harvest:['tenho tomate para vender','sou Ana tenho uma colheita de tomate','colhi tomates hoje','minha colheita esta pronta','vou colher tomate amanha','quero cadastrar lote','tenho quilos de tomate classe A','sou Paulo tenho tomate classe B','disponibilidade de tomate para venda','colheita pronta em Bonfim'],
 confirm:['confirmo','sim confirmar lote','confirmar dados corretos','esta certo pode salvar','confirmo minha colheita','dados corretos confirmado'],
 cancel:['cancelar','cancela lote','quero cancelar','apagar rascunho','desistir cancelar colheita','nao quero continuar'],
 earnings:['comparar ganhos','quanto vou ganhar','qual o lucro','preco local e exportacao','comparar venda local','ganhos liquidos custos transporte','quanto recebo pela venda']};
const vocabulary=[...new Set(Object.values(examples).flat().flatMap(tokens))].sort(),labels=Object.keys(examples),weights={},priors={};
for(const label of labels){const counts={}; const ws=examples[label].flatMap(tokens); for(const w of ws) counts[w]=(counts[w]||0)+1;weights[label]=Object.fromEntries(vocabulary.map(w=>[w,Math.log(((counts[w]||0)+1)/(ws.length+vocabulary.length))]));priors[label]=examples[label].length/Object.values(examples).flat().length;}
const model={name:'HarvestIntent-PT v1',architecture:'Multinomial naive Bayes, Laplace smoothing, bag of words',license:'MIT',trainedOn:'Small authored Portuguese intent corpus; not a generative LLM',labels,vocabulary,weights,priors,examples};
await mkdir(new URL('../public/',import.meta.url),{recursive:true});await writeFile(new URL('../public/model.json',import.meta.url),JSON.stringify(model));
console.log('Model bytes:',Buffer.byteLength(JSON.stringify(model)));
