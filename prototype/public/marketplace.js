import {poolLots,compare,demoCosts,crops,normal} from './core.js?release=v38';
export const shipmentHold='awaiting buyer confirmation and trade-requirement checks';
export const marketOrders=[
 {id:'DEMO-TOMATO',crop:'tomato',grade:'A',quantityKg:200,sourceLocation:'Bonfim',buyer:'Lethem Fresh Produce (fictional importer)',destination:'Lethem, Guyana',priceGydKg:250,earliest:'2026-10-04',latest:'2026-10-10'},
 {id:'DEMO-CASSAVA',crop:'cassava',grade:'A',quantityKg:300,sourceLocation:'Boa Vista',buyer:'Rupununi Foods (fictional importer)',destination:'Lethem, Guyana',priceGydKg:180,earliest:'2026-10-04',latest:'2026-10-10'},
 {id:'DEMO-BANANA',crop:'banana',grade:'A',quantityKg:150,sourceLocation:'Bonfim',buyer:'Border Fruit Market (fictional importer)',destination:'Lethem, Guyana',priceGydKg:220,earliest:'2026-10-04',latest:'2026-10-10'}
].map(o=>({...o,label:'DEMONSTRATION ORDER — fictional, not a purchase commitment'}));
export function marketOrder(session){return session.demoMarketplace?marketOrders.find(o=>session.marketOrderId?o.id===session.marketOrderId:session.assistant?.focusCrop?o.crop===session.assistant.focusCrop:o.id==='DEMO-TOMATO'):null;}
export function marketView(session,lots=[],choices=[],handovers=[]){
 const order=marketOrder(session),at=new Date().toISOString();
 if(!order)return {enabled:false,observedAt:at,orders:marketOrders,status:shipmentHold};
 // Synthetic availability exists only in the opted-in demonstration view, never in farmer records.
 const example={id:'DEMO-SYNTHETIC-'+order.crop,farmer:'Fictional partner farmer',farmerId:'DEMO-PARTNER',crop:order.crop,location:order.sourceLocation,quantityKg:80,grade:'A',harvestDate:'2026-10-04',localPriceBrl:3.5,confirmedAt:'2026-10-04T00:00:00Z',status:'available',synthetic:true};
 const compatible=lots.filter(l=>!l.synthetic).map(l=>normal(l.location||'').startsWith(normal(order.sourceLocation))?{...l,location:order.sourceLocation}:l);
 const pool=poolLots([...compatible,example],order),costs={...demoCosts},comparison=compare(pool,costs,order);
 const ownIds=new Set(lots.filter(l=>l.farmerId===session.account?.id).map(l=>l.id));
 return {enabled:true,observedAt:at,source:'SIMULATED marketplace, buyers, prices, transport and trade tasks',orders:marketOrders,order,costs,pooledKg:pool.quantityKg,shortfallKg:pool.shortfallKg,syntheticKg:pool.allocations.filter(a=>a.lot.synthetic).reduce((s,a)=>s+a.kg,0),ownAllocations:comparison.farmers.filter(f=>ownIds.has(f.id)),transport:{id:'DEMO-ROUTE-01',carrier:'Border Harvest Transport (fictional)',route:order.sourceLocation+' → '+order.destination,pickup:'2026-10-05 07:00–09:00 local, illustrative',capacityKg:500,transportBrlKg:costs.crossTransportBrlKg,booking:'not booked'},trade:{exporter:'HarvestLink Export Desk (fictional)',originCountry:'Brazil',destinationCountry:'Guyana',checks:{buyerConfirmation:'pending',exporterEligibility:'unchecked',importRequirements:'unchecked',plantHealthRequirements:'unchecked',quality:'unconfirmed',payment:'unconfirmed'},dispatchAuthorized:false},handovers:handovers.filter(h=>h.farmerId===session.account?.id),status:shipmentHold};
}
export function marketMessage(text,session,context={}){
 const t=normal(text).trim(),en=session.account?.language==='en',say=(a,b)=>en?a:b;
 if(!/^(demo market|demo mercado|demo off|market|mercado|logistics|logistica|trade|comercio|handover|repasse|offer demo-[a-z]+)$/.test(t)&&!session.pendingHandover)return null;
 if(!session.account)return null;
 if(t==='demo market'||t==='demo mercado')return {session:{...session,demoMarketplace:true,marketOrderId:marketOrders.find(o=>o.crop===(session.assistant?.focusCrop||(context.lots||[]).find(l=>l.id===session.lastLotId&&l.farmerId===session.account.id)?.crop))?.id||null},reply:say('DEMO enabled: fictional buyers, prices and an 80 kg partner lot. Your real records remain separate. Send MARKET, LOGISTICS, TRADE or COMPARE EARNINGS.','DEMO ativada: compradores, preços e 80 kg fictícios. Envie MERCADO, LOGISTICA, COMERCIO ou COMPARAR GANHOS.')};
 if(t==='demo off')return {session:{...session,demoMarketplace:false,pendingHandover:null},reply:say('Demo disabled. Confirmed records preserved.','Demo desativada. Registros preservados.')};
 if(t.startsWith('offer ')){const order=marketOrders.find(o=>o.id===t.slice(6).toUpperCase());if(!order)return {session,reply:'Unknown demo order / Pedido desconhecido.'};return {session:{...session,demoMarketplace:true,marketOrderId:order.id},reply:say('Selected fictional order '+order.id+'. Send MARKET.','Pedido fictício selecionado '+order.id+'. Envie MERCADO.')};}
 const view=marketView(session,context.lots,context.choices,context.handovers);
 if(!view.enabled)return {session,reply:say('Send DEMO MARKET to explore the simulated marketplace. No live buyer feed is connected.','Envie DEMO MERCADO para explorar o mercado simulado. Sem compradores reais conectados.')};
 if(session.pendingHandover){
  if(/^(cancel|cancelar)$/.test(t))return {session:{...session,pendingHandover:null},reply:say('Handover draft cancelled.','Rascunho de repasse cancelado.')};
  if(!/^(confirm|confirmo)$/.test(t))return {session,reply:say('Review the fictional handover. Reply CONFIRM or CANCEL.','Revise o repasse fictício. Envie CONFIRMO ou CANCELAR.')};
  const handover={...session.pendingHandover,id:crypto.randomUUID(),createdAt:new Date().toISOString(),humanConfirmed:true};
  return {session:{...session,pendingHandover:null},handover,reply:say('Demo handover saved. ','Repasse demo salvo. ')+shipmentHold+'. No dispatch authorized.'};
 }
 if(t==='market'||t==='mercado')return {session,reply:say('SIMULATED MARKET','MERCADO SIMULADO')+' · '+view.observedAt+'\n'+marketOrders.map(o=>`${o.id}: ${o.quantityKg} kg ${crops[o.crop][en?'en':'pt']} · ${o.sourceLocation} → ${o.destination} · GYD ${o.priceGydKg}/kg`).join('\n')+`\n${view.order.id}: ${view.pooledKg}/${view.order.quantityKg} kg (${view.syntheticKg} kg fictional partner); ${view.shortfallKg} kg missing. Send OFFER <ID> to select. No purchase confirmed.`};
 if(t==='logistics'||t==='logistica')return {session,reply:say('SIMULATED LOGISTICS','LOGISTICA SIMULADA')+` · ${view.transport.carrier}\n${view.transport.route}; pickup ${view.transport.pickup}; capacity ${view.transport.capacityKg} kg; BRL ${view.transport.transportBrlKg}/kg. Not booked; no dispatch authorized.`};
 if(t==='trade'||t==='comercio')return {session,reply:say('SIMULATED IMPORT / EXPORT','IMPORTACAO / EXPORTACAO SIMULADA')+` · Brazil → Guyana\n${view.trade.exporter}. Buyer: pending; exporter, import and plant-health requirements: unchecked; quality and payment: unconfirmed. ${shipmentHold}. Send HANDOVER after confirming your proposal choice.`};
 const choice=(context.choices||[]).find(c=>c.orderId===view.order.id&&c.choice==='cross-border-proposal'&&(context.lots||[]).some(l=>l.id===c.lotId&&l.farmerId===session.account.id));
 if(!choice)return {session,reply:say('First compare earnings, CHOOSE PROPOSAL and CONFIRM your choice. No handover created.','Primeiro compare ganhos, ESCOLHO PROPOSTA e CONFIRMO. Nenhum repasse criado.')};
 const draft={farmerId:session.account.id,orderId:view.order.id,choiceId:choice.id,quantityKg:choice.quantityKg,exporter:view.trade.exporter,transport:view.transport,checks:view.trade.checks,status:shipmentHold,dispatchAuthorized:false,demo:true};
 return {session:{...session,pendingHandover:draft},reply:say('Review DEMO handover: ','Revise o repasse DEMO: ')+`${draft.quantityKg} kg to ${draft.exporter}. Transport not booked; checks pending. Reply ${en?'CONFIRM or CANCEL':'CONFIRMO ou CANCELAR'}. ${shipmentHold}.`};
}

export function marketPoolLots(lots,order){return [...lots.filter(l=>!l.synthetic).map(l=>normal(l.location||'').startsWith(normal(order.sourceLocation))?{...l,location:order.sourceLocation}:l),{id:'DEMO-SYNTHETIC-'+order.crop,farmer:'Fictional partner farmer',farmerId:'DEMO-PARTNER',crop:order.crop,location:order.sourceLocation,quantityKg:80,grade:'A',harvestDate:'2026-10-04',localPriceBrl:3.5,confirmedAt:'2026-10-04T00:00:00Z',synthetic:true}];}
