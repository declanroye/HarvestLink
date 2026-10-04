export const normal = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const tokens = s => normal(s).match(/[a-z]+/g) || [];
export function classify(text, model) {
  if(typeof model.predict==='function'){
    const result=model.predict(text),map={compare:'earnings',offer:'harvest',correct:'harvest',help:'help',cancel:'cancel',other:'unknown'};
    return {...result,intent:result.needsClarification?'unknown':map[result.intent],rawIntent:result.intent,confidence:result.confidenceScore};
  }
  const words = tokens(text).filter(w => model.vocabulary.includes(w));
  if (!words.length) return {intent:'unknown', confidence:0};
  const scores = model.labels.map(label => Math.log(model.priors[label]) + words.reduce((s,w) => s + model.weights[label][w], 0));
  const max = Math.max(...scores), exp = scores.map(s => Math.exp(s-max)), sum = exp.reduce((a,b)=>a+b,0);
  const i = scores.indexOf(max), confidence = exp[i]/sum;
  return {intent:confidence >= .65 ? model.labels[i] : 'unknown',confidence};
}
export const profiles={general:{id:'general',crop:null,location:null},bonfim:{id:'bonfim',crop:'tomato',location:'Bonfim, Roraima'}};
export const crops={tomato:{pt:'tomate',en:'tomatoes',terms:['tomate','tomates']},cassava:{pt:'mandioca',en:'cassava',terms:['mandioca','macaxeira','aipim']},maize:{pt:'milho',en:'maize',terms:['milho']},rice:{pt:'arroz',en:'rice',terms:['arroz']},beans:{pt:'feijão',en:'beans',terms:['feijao']},banana:{pt:'banana',en:'bananas',terms:['banana','bananas']},papaya:{pt:'mamão',en:'papayas',terms:['mamao']}};
export const required = ['farmer','crop','location','quantityKg','grade','harvestDate','localPriceBrl'];
export const questions = {
  crop:'O que você colheu? Exemplo: tomate, mandioca, milho, arroz, feijão, banana ou mamão.',
  location:'Onde está sua colheita? Exemplo: em Boa Vista.',
  farmer:'Qual é seu nome? Exemplo: meu nome é Ana.',
  quantityKg:'Quantos quilos estão disponíveis? Exemplo: 120 kg. Não use caixas sem informar o peso.',
  grade:'Qual é a classificação? Digite classe A ou classe B.',
  harvestDate:'Qual é a data da colheita? Use AAAA-MM-DD.',
  localPriceBrl:'Qual preço local por kg você consegue? Exemplo: R$ 3,50/kg.'
};
export function extract(text, previous={},profile=profiles.bonfim) {
  const t = normal(text), draft = {...(profile.crop?{crop:profile.crop}:{}),...(profile.location?{location:profile.location}:{}),...previous};
  const detected=Object.entries(crops).filter(([id,c])=>c.terms.some(term=>new RegExp('\\b'+term+'\\b').test(t)));
  if(detected.length===1)draft.crop=detected[0][0];
  if(detected.length>1)draft.crop=null;
  const place=text.match(/(?:\bem\s+|local(?:idade)?:\s*)([\p{L}][\p{L} '-]{1,50}?)(?=[,.!\n]|\s+(?:classe|tipo|colheita|R\$|preco|tenho|com)|$)/iu);
  if(place)draft.location=place[1].trim();
  const name = text.match(/(?:meu nome [ée]|sou|nome:)\s+([\p{L}][\p{L} '-]{0,35}?)(?=[,.!\n]|\s+(?:tenho|vou|colhi|com)|$)/iu);
  const qty = t.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|quilos?|quilogramas?)\b/);
  const grade = t.match(/(?:classe|tipo|categoria)\s*([ab])\b/);
  const date = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const price = t.match(/(?:r\$|brl|preco(?: local)?(?: de)?|vendo por)\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*kg|por\s*(?:kg|quilo))?/);
  if(name) draft.farmer=name[1].trim();
  if(qty) draft.quantityKg=Number(qty[1].replace(',','.'));
  if(grade) draft.grade=grade[1].toUpperCase();
  if(date) draft.harvestDate=date[1];
  if(price) draft.localPriceBrl=Number(price[1].replace(',','.'));
  return draft;
}
export function missing(d) {return required.filter(k => !d[k]);}
export function validateLot(d) {
  if(missing(d).length) throw Error('Faltam campos: '+missing(d).join(', '));
  if(!Number.isFinite(d.quantityKg)||d.quantityKg<=0||d.quantityKg>100000) throw Error('Quantidade inválida.');
  if(!Number.isFinite(d.localPriceBrl)||d.localPriceBrl<=0) throw Error('Preço inválido.');
  if(!['A','B'].includes(d.grade)) throw Error('Classe inválida.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.harvestDate)||new Date(d.harvestDate+'T00:00:00Z').toISOString().slice(0,10)!==d.harvestDate) throw Error('Data inválida.');
  if(typeof d.farmer!=='string'||!d.farmer.trim()||d.farmer.length>60) throw Error('Nome inválido.');
  if(!crops[d.crop])throw Error('Cultura não reconhecida. Informe uma das culturas suportadas.');
  if(typeof d.location!=='string'||d.location.trim().length<2||d.location.length>80)throw Error('Localidade inválida.');
  return d;
}
export function lotSummary(d,language='pt') {
  if(language==='en') return `${d.farmer}: ${d.quantityKg} kg ${crops[d.crop]?.en||d.crop}, grade ${d.grade}, harvest ${d.harvestDate}, ${d.location}. Farmer-confirmed availability only; not a shipment commitment.`;
  return `${d.farmer}: ${d.quantityKg} kg de ${crops[d.crop]?.pt||d.crop}, classe ${d.grade}, colheita ${d.harvestDate}, ${d.location}. Preço local informado: R$ ${d.localPriceBrl}/kg. Confirme ou corrija antes de salvar.`;
}
export const demoOrder={id:'DEMO-LETHEM-001',label:'DEMONSTRATION ORDER — not a purchase commitment',buyer:'Demonstration produce importer • Lethem',sourceLocation:'Bonfim, Roraima',crop:'tomato',grade:'A',quantityKg:200,earliest:'2026-10-04',latest:'2026-10-05',priceGydKg:250};
export const demoCosts={asOf:'2026-10-03',validUntil:'2026-10-10',source:'DEMONSTRATION assumptions; not live FX, freight quotations or trade charges',gydPerBrl:40,localTransportBrlKg:.25,crossTransportBrlKg:.65,packagingBrlKg:.30,handlingBrlKg:.20,feePercent:2,lossPercent:5,tradeAllowanceBrl:50};
export function poolLots(lots, order=demoOrder) {
  let left=order.quantityKg; const allocations=[];
  for(const lot of [...lots].sort((a,b)=>a.harvestDate.localeCompare(b.harvestDate)||String(a.confirmedAt||'').localeCompare(String(b.confirmedAt||''))||a.id.localeCompare(b.id))) {
    if(lot.status==='withdrawn'||!lot.confirmedAt||lot.reservedOrderId||(order.sourceLocation&&normal(lot.location||'')!==normal(order.sourceLocation))||lot.crop!==order.crop||lot.grade!==order.grade||lot.harvestDate<order.earliest||lot.harvestDate>order.latest) continue;
    const kg=Math.min(lot.quantityKg,left); if(kg>0) allocations.push({lot,kg}); left-=kg;
  }
  return {allocations,quantityKg:order.quantityKg-left,shortfallKg:left,matched:left===0};
}
export function compare(pool,costs=demoCosts,order=demoOrder) {
  for(const key of ['gydPerBrl','localTransportBrlKg','crossTransportBrlKg','packagingBrlKg','handlingBrlKg','feePercent','lossPercent','tradeAllowanceBrl']) if(!Number.isFinite(costs[key])||costs[key]<0) throw Error('Invalid cost: '+key);
  if(costs.gydPerBrl===0||costs.lossPercent>=100||costs.feePercent>=100) throw Error('Invalid rate or percentage.');
  const q=pool.quantityKg, billedKg=q*(1-costs.lossPercent/100), grossGyd=billedKg*order.priceGydKg,grossBrl=grossGyd/costs.gydPerBrl;
  const rows=[['Transport',q*costs.crossTransportBrlKg],['Packaging',q*costs.packagingBrlKg],['Handling',q*costs.handlingBrlKg],['Coordination fee',grossBrl*costs.feePercent/100],['Trade-cost allowance (unverified)',q?costs.tradeAllowanceBrl:0]];
  const totalCosts=rows.reduce((s,r)=>s+r[1],0),crossNet=grossBrl-totalCosts;
  const farmers=pool.allocations.map(({lot,kg})=>({id:lot.id,name:lot.farmer,kg,localGross:kg*lot.localPriceBrl,localCost:kg*costs.localTransportBrlKg,localNet:kg*(lot.localPriceBrl-costs.localTransportBrlKg),crossNet:q?crossNet*kg/q:0}));
  return {q,billedKg,grossGyd,grossBrl,rows,totalCosts,crossNet,farmers,localNet:farmers.reduce((s,f)=>s+f.localNet,0),expired:new Date().toISOString().slice(0,10)>costs.validUntil};
}
export function handleMessage(text,session,model,context={}) {
  if(text.length>1000) return {reply:'Mensagem muito longa. Use até 1000 caracteres.',session};
  const t=normal(text).trim(), intent=classify(text,model);
  if(/^(help|ajuda|ola|oi)$/.test(t))return {reply:'Olá! Sou o HarvestLink. Diga seu nome, cultura, local, quilos, classe, data da colheita (AAAA-MM-DD) e preço local (R$/kg). Eu peço o que faltar. Você confirma antes de salvar. Depois envie COMPARAR GANHOS, ESCOLHO LOCAL, ESCOLHO PROPOSTA ou CANCELAR.',session,intent};
  if(/^(cancelar|cancela)$/.test(t)) return {reply:'Rascunho cancelado. Envie uma nova colheita.',session:{...session,draft:{},pendingChoice:null}};
  if(/^(confirmo|confirmar|sim)$/.test(t)&&session.draft&&missing(session.draft).length===0) {
    try {validateLot(session.draft);} catch(e) {return {reply:e.message,session};}
    const lot={...session.draft,id:crypto.randomUUID(),confirmedAt:new Date().toISOString(),confirmation:'explicit farmer confirmation',source:session.source||'offline-app'};
    return {reply:`Lote confirmado: ${lot.quantityKg} kg, classe ${lot.grade}, ${lot.harvestDate}. ID ${lot.id.slice(0,8)}. Nenhuma remessa foi autorizada.`,lot,session:{draft:{},source:session.source,lastLotId:lot.id},intent};
  }
  const choosing=/^escolho (local|proposta)$/.exec(t);
  if((intent.intent==='earnings'||t==='comparar ganhos'||choosing)&&!Object.keys(session.draft||{}).length) {
    const order=context.order===undefined?demoOrder:context.order;
    if(!order)return {reply:'Seu lote pode ser registrado sem um pedido. Ainda não há oferta de comprador para comparar; aguarde uma proposta do coordenador. Nenhuma venda foi confirmada.',session,intent};
    const pool=poolLots(context.lots||[],order),costs=context.costs||demoCosts,comparison=compare(pool,costs,order);
    const farmer=comparison.farmers.find(f=>f.id===session.lastLotId);
    if(!farmer)return {reply:'Confirme seu lote primeiro. Depois envie COMPARAR GANHOS.',session,intent};
    if(!pool.matched)return {reply:'Seu lote está confirmado. O pedido de demonstração ainda precisa de '+pool.shortfallKg+' kg compatíveis. Nenhuma venda confirmada.',session,intent};
    if(comparison.expired)return {reply:'Os custos estão vencidos. Aguarde atualização pelo coordenador antes de escolher.',session,intent};
    if((context.choices||[]).some(c=>c.lotId===farmer.id))return {reply:'Seu lote já tem uma escolha confirmada. O coordenador pode revisar com você. Nenhuma remessa autorizada.',session,intent};
    const summary='DEMONSTRAÇÃO · '+farmer.kg+' kg alocados. Local líquido: R$ '+farmer.localNet.toFixed(2)+'. Proposta líquida estimada: R$ '+farmer.crossNet.toFixed(2)+'. Custos de '+costs.asOf+', válidos até '+costs.validUntil+'. Câmbio: '+costs.gydPerBrl+' GYD/BRL; preço: '+order.priceGydKg+' GYD/kg; perda: '+costs.lossPercent+'%. Custos do pedido (BRL): '+comparison.rows.map(([n,v])=>({Transport:'transporte',Packaging:'embalagem',Handling:'manuseio','Coordination fee':'coordenação','Trade-cost allowance (unverified)':'reserva comercial não verificada'}[n])+': '+v.toFixed(2)).join(', ')+'. Rateio por kg.';
    if(!choosing)return {reply:summary+' Envie ESCOLHO LOCAL ou ESCOLHO PROPOSTA. Remessa aguarda confirmação do comprador e verificação comercial.',session,intent};
    const pendingChoice={id:crypto.randomUUID(),lotId:farmer.id,farmer:farmer.name,quantityKg:farmer.kg,choice:choosing[1]==='local'?'local':'cross-border-proposal',orderId:order.id,costSnapshot:{...costs},orderSnapshot:{...order},comparisonSnapshot:comparison,status:'awaiting buyer confirmation and trade-requirement checks',synced:false};
    return {reply:summary+' Sua escolha: '+(choosing[1]==='local'?'venda local':'proposta para revisão')+'. Responda CONFIRMO para registrar ou CANCELAR. Nenhuma remessa autorizada.',session:{...session,pendingChoice},intent};
  }
  if(/^(confirmo|confirmar|sim)$/.test(t)&&session.pendingChoice) {
    if(new Date().toISOString().slice(0,10)>session.pendingChoice.costSnapshot.validUntil)return {reply:'Custos vencidos. Peça uma nova comparação.',session:{...session,pendingChoice:null},intent};
    if((context.choices||[]).some(c=>c.lotId===session.pendingChoice.lotId))return {reply:'Escolha já registrada.',session:{...session,pendingChoice:null},intent};
    const choice={...session.pendingChoice,createdAt:new Date().toISOString(),humanConfirmed:true,confirmationSource:session.source||'offline-conversation'};
    return {reply:'Escolha confirmada: '+(choice.choice==='local'?'venda local':'proposta para revisão')+'. Registro salvo. Remessa aguarda confirmação do comprador e verificação comercial.',choice,session:{...session,pendingChoice:null},intent};
  }
  const draft=extract(text,session.draft||{},context.profile||session.profile||profiles.bonfim), fields=missing(draft);
  if(intent.intent==='unknown'&&required.every(k=>draft[k]===session.draft?.[k])) return {reply:'Não entendi com segurança. Envie: sou Ana, tenho 120 kg de tomate, classe A, colheita 2026-10-04, R$ 3,50/kg.',session,intent};
  if(!fields.length) {try {validateLot(draft);} catch(e) {return {reply:e.message,session:{...session,draft},intent};}}
  return {reply:fields.length?questions[fields[0]]:lotSummary(draft)+' Responda CONFIRMO.',session:{...session,draft},intent};
}
