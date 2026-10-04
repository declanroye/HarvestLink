import {normal,crops,poolLots,compare,missing} from './core.js?release=v36';
import {marketView,marketOrders,marketPoolLots} from './marketplace.js?release=v36';
const choose=(session,en,pt)=>session.account?.language==='en'?en:pt;
export function assistantPlan(session,context={}){
 const own=(context.lots||[]).filter(l=>l.farmerId===session.account?.id&&!l.synthetic&&l.status!=='withdrawn');
 const choice=(context.choices||[]).find(c=>own.some(l=>l.id===c.lotId));
 const market=marketView(session,context.lots,context.choices,context.handovers);
 const selected=own.find(l=>l.id===session.lastLotId)||(own.length===1?own[0]:null);
 const tasks=[{id:'harvest',done:!!own.length,label:choose(session,'Confirm harvest availability','Confirmar disponibilidade')},{id:'compare',done:!!choice,label:choose(session,'Match buyers and compare net earnings','Encontrar compradores e comparar ganhos')},{id:'choice',done:!!choice,label:choose(session,'Review and confirm your sales choice','Revisar e confirmar sua escolha')},{id:'handover',done:(context.handovers||[]).some(h=>h.farmerId===session.account?.id),label:choose(session,'Prepare a reviewed exporter handover','Preparar repasse ao exportador')}];
 return {goal:session.assistant?.goal||choose(session,'Turn my harvest into a considered sale','Transformar minha colheita em uma venda avaliada'),tasks,own,selected,market,connectivity:context.offline?'offline':'online'};
}
export function routeAssistant(text,session,context={}){
 if(!session.account||session.onboarding||typeof text!=='string')return {command:text};
 if(/^(compare earnings|comparar ganhos)$/i.test(text.trim()))return {command:text};
 const t=normal(text).trim(),say=(en,pt)=>choose(session,en,pt);
 // Pending reviews retain explicit CONFIRM/CANCEL semantics; natural-language requests never commit a decision.
 if(session.pendingChoice||session.pendingAccount||session.pendingWithdrawal||session.pendingHandover)return {command:text};
 const selection=/^(?:use lot|select lot|usar lote|selecionar lote) ([a-z0-9-]{4,36})$/.exec(t);
 if(selection){const lots=(context.lots||[]).filter(l=>l.farmerId===session.account.id&&l.id.startsWith(selection[1])&&l.status!=='withdrawn');return {result:{session:lots.length===1?{...session,lastLotId:lots[0].id}:session,reply:lots.length===1?say('Selected your lot. Ask “What is my best option?”','Lote selecionado. Pergunte “Qual a melhor opção?”'):say('I need one unambiguous lot ID from your LOTS list.','Preciso de um ID único da sua lista LOTES.')}};}
 const intent=/^(?:hello|hi|hey|oi|ola|good morning|bom dia|plan|my plan|next|what next|what should i do next|how can you help|what can you do|plano|meu plano|proximo|o que fazer agora|como pode me ajudar)[?.!]*$/.test(t)?'plan':/(help me sell|sell my harvest|find (?:me )?(?:a )?buyer|selling my|ajude.*vender|vender minha colheita|encontrar comprador)/.test(t)?'sell':/(best option|best price|more money|should i sell|what can i earn|how much.*earn|compare.*(?:earnings|sale|options)|melhor opcao|melhor preco|ganhar mais|quanto.*ganhar)/.test(t)?'recommend':/(arrange.*(?:transport|pickup)|book.*(?:transport|pickup)|pickup plan|how.*(?:transport|pickup)|organizar transporte|coleta|logistica)/.test(t)?'logistics':/(export.*(?:paper|document|handover)|prepare.*handover|import.*requirements|border.*checks|documentos.*export|requisitos.*import)/.test(t)?'trade':/(what.*(?:remember|know).*me|my situation|resumir.*situacao|o que sabe.*mim)/.test(t)?'memory':null;
 if(!intent)return {command:text};
 const next={...session,assistant:{...(session.assistant||{}),goal:intent==='sell'?text.slice(0,180):session.assistant?.goal,updatedAt:new Date().toISOString()}};
 if(intent==='sell'&&/\d+\s*(kg|kilos?|quilos?)/i.test(text))return {command:text,session:next};
 const plan=assistantPlan(next,context),reply=message=>({result:{session:next,reply:message,intent:{intent:'assistant-'+intent}}});
 const boundary=context.offline?say('I’m working on this phone. Buyer and logistics information is the last saved/demo snapshot; nothing is sent until you reconnect and submit.','Estou trabalhando neste telefone. Uso a última versão salva/demo; nada é enviado antes de reconectar e sincronizar.'):say('I’m using your saved account and the shared demo marketplace. Buyer and transport details are fictional.','Uso sua conta salva e o mercado demo compartilhado. Compradores e transporte são fictícios.');
 if(intent==='logistics')return {command:'LOGISTICS',session:next};
 if(intent==='trade')return {command:/handover|repasse/.test(t)?'HANDOVER':'TRADE',session:next};
 if(intent==='memory')return reply(`${session.account.name} · ${session.account.location}. `+say(`I have ${plan.own.length} confirmed available lots for your account. `,`Tenho ${plan.own.length} lotes disponíveis confirmados na sua conta. `)+plan.own.slice(-4).map(l=>`${l.id.slice(0,8)}: ${l.quantityKg} kg ${crops[l.crop]?.[session.account.language==='en'?'en':'pt']} · ${l.harvestDate}`).join('\n')+'\n'+boundary);
 if(intent==='recommend'||intent==='sell'&&plan.own.length&&!Object.keys(session.draft||{}).length){
  if(Object.keys(session.draft||{}).length)return reply(say('Let’s finish reviewing your harvest first. Still needed: ','Vamos terminar sua colheita primeiro. Falta: ')+missing(session.draft).join(', ')+say('. Nothing is saved until you CONFIRM.','. Nada é salvo antes de CONFIRMO.'));
  if(!plan.selected)return reply(say('Choose which harvest I should work on. Send HARVEST if you have none, or USE LOT <ID> from LOTS.','Escolha a colheita. Envie COLHEITA se não tiver lote, ou USAR LOTE <ID> da lista LOTES.'));
  if(!session.demoMarketplace)return reply(say('I can compare your local option with buyer proposals, but no live buyer feed is connected. Send DEMO MARKET to explore clearly fictional offers, or keep your confirmed lot available.','Posso comparar a venda local com propostas, mas não há compradores reais conectados. Envie DEMO MERCADO para explorar ofertas fictícias.'));
  const results=marketOrders.map(order=>{const pool=poolLots(marketPoolLots(context.lots||[],order),order),costs=context.costs||plan.market.costs,c=compare(pool,costs,order),farmer=c.farmers.find(f=>f.id===plan.selected.id);return {order,pool,c,farmer};}).filter(r=>r.farmer).sort((a,b)=>b.farmer.crossNet-a.farmer.crossNet);
  if(!results.length)return reply(say('I checked the demo orders against your crop, area, grade and harvest date. None match this lot. Keep it available; I won’t invent a buyer.','Verifiquei cultura, área, classe e data. Nenhum pedido demo corresponde ao lote. Vou manter a disponibilidade sem inventar comprador.'));
  const r=results[0];if(r.c.expired)return reply(say('I found compatible demo offers, but the saved costs have expired. I need updated assumptions before recommending earnings. Your confirmed records are preserved.','Encontrei propostas compatíveis, mas os custos salvos venceram. Preciso de custos atualizados antes de recomendar ganhos.'));const delta=r.farmer.crossNet-r.farmer.localNet;
  next.assistant={...next.assistant,lastCheckAt:new Date().toISOString(),recommendedOrderId:r.order.id};
  return reply(say('I checked compatible demo buyers. ','Verifiquei compradores demo compatíveis. ')+`${r.order.id}: ${r.farmer.kg} kg · `+say(`local BRL ${r.farmer.localNet.toFixed(2)}; proposal BRL ${r.farmer.crossNet.toFixed(2)}; difference BRL ${delta.toFixed(2)}. `,`local BRL ${r.farmer.localNet.toFixed(2)}; proposta BRL ${r.farmer.crossNet.toFixed(2)}; diferença BRL ${delta.toFixed(2)}. `)+say(`Pool ${r.pool.quantityKg}/${r.order.quantityKg} kg. Costs dated ${r.c.expired?'EXPIRED · ':''}${(context.costs||plan.market.costs).asOf}. `,`Grupo ${r.pool.quantityKg}/${r.order.quantityKg} kg. Custos ${r.c.expired?'VENCIDOS · ':''}${(context.costs||plan.market.costs).asOf}. `)+say(`I can prepare this proposal for your review. Say “review that offer”, or “show the costs” to inspect every deduction. You decide after reviewing. `,`Posso preparar a proposta para sua revisão. Diga “revisar essa oferta” ou “mostrar custos” para ver as deduções. Você decide. `)+boundary);
 }
 return reply(say(`Let’s work on your sale, ${session.account.name}.\n`,`Vamos trabalhar na sua venda, ${session.account.name}.\n`)+plan.tasks.map((task,i)=>`${task.done?'✓':i+1+'.'} ${task.label}`).join('\n')+'\n'+say('Next: ','Próximo: ')+(Object.keys(session.draft||{}).length?say('finish the harvest details.','termine os detalhes da colheita.'):!plan.own.length?say('tell me what you have, for example “I have 120 kg of tomatoes”.','diga o que tem, por exemplo “tenho 120 kg de tomate”.'):say('ask “What is my best option?” I’ll check compatible orders and net earnings.','pergunte “Qual a melhor opção?” Vou verificar pedidos e ganhos líquidos.'))+'\n'+boundary);
}
export function assistantFollowThrough(result,context={}){
 const session=result.session;
 if(!session.account)return result;
 if(result.lot){
  const nextContext={...context,lots:[...(context.lots||[]).filter(l=>l.id!==result.lot.id),result.lot]};
  const check=routeAssistant(session.account.language==='en'?'What is my best option?':'Qual a melhor opção?',session,nextContext).result;
  if(check){result.reply+='\n\n'+choose(session,'I’ve also checked your next selling step.\n','Também verifiquei seu próximo passo de venda.\n')+check.reply;result.session=check.session;}
 }
 if(result.choice)result.reply+='\n'+choose(session,result.choice.choice==='cross-border-proposal'?'Next, ask me to prepare an exporter handover. Buyer approval, transport and trade checks remain open.':'Your local choice is saved. Ask MY PLAN to review your remaining work.',result.choice.choice==='cross-border-proposal'?'Agora peça o repasse ao exportador. Aprovação, transporte e verificações seguem pendentes.':'Sua escolha local está salva. Envie MEU PLANO para revisar o trabalho restante.');
 return result;
}
