import {normal,handleMessage,extract,lotSummary,crops,profiles,classify} from './core.js?release=v14';
const accountMenu='COLHEITA · LOTES · PROPOSTAS · STATUS · CONTA · ALTERAR NOME <nome> · ALTERAR LOCAL <cidade> · RETIRAR LOTE <ID> · SUPORTE · EXPORTAR. CONFIRMO salva uma revisão; CANCELAR abandona um rascunho.';
const accountMenuEn='HARVEST · LOTS · OFFERS · STATUS · ACCOUNT · CHANGE NAME <name> · CHANGE LOCATION <town> · WITHDRAW LOT <ID> · SUPPORT · EXPORT. CONFIRMO saves a review; CANCEL abandons a draft. Harvest input remains Portuguese in this pilot.';
const accountQuestions={consent:'Olá! Vamos criar seu perfil. Salvamos seu nome e cidade para registrar colheitas. Um lote confirmado pode ser apresentado a compradores. Não envie documentos ou dados bancários. Digite ACEITO para continuar ou CANCELAR.',name:'Como você prefere ser chamado? Envie somente seu nome.',location:'Em qual cidade ou comunidade você produz? Envie somente o local, sem endereço residencial.',language:'Qual idioma para menus e conta? PT para português ou EN for English. A interpretação de colheitas deste piloto usa português.'};
const cleanValue=s=>s.trim().replace(/^(?:sou|meu nome [ée]|nome:|em|local:)\s+/iu,'');
const accountSummary=a=>`${a.name} · ${a.location} · ${a.language==='en'?'English':'Português'} · ID ${a.id.slice(0,8)}`;
const owned=(session,context)=> (context.lots||[]).filter(l=>l.farmerId===session.account?.id);
export function handleFarmerMessage(text,session,model,context={}){
 if(typeof text!=='string'||text.length>1000)return {reply:'Use uma mensagem de até 1000 caracteres.',session};
 const t=normal(text).trim(), reply=(message,next=session,extra={})=>({reply:message,session:next,...extra});
 if(/^(cancelar|cancela|cancel)$/.test(t))return reply('Rascunho cancelado. Seus registros confirmados foram preservados.',{...session,onboarding:null,pendingAccount:null,pendingWithdrawal:null,pendingChoice:null,draft:{}});
 if(session.onboarding){
  const onboarding={...session.onboarding},d={...onboarding.draft};
  if(onboarding.step==='consent'){
   if(t!=='aceito'&&t!=='i agree')return reply(accountQuestions.consent);
   onboarding.step='name';return reply(accountQuestions.name,{...session,onboarding});
  }
  if(onboarding.step==='name'||onboarding.step==='location'){
   const value=cleanValue(text);if(value.length<2||value.length>60||!/^[\p{L}\p{N} .,'’-]+$/u.test(value))return reply('Envie um nome ou local de 2 a 60 caracteres.');
   d[onboarding.step]=value;onboarding.draft=d;onboarding.step=onboarding.step==='name'?'location':'language';return reply(accountQuestions[onboarding.step],{...session,onboarding});
  }
  if(onboarding.step==='language'){
   if(!['pt','en','portugues','english'].includes(t))return reply(accountQuestions.language);
   d.language=['en','english'].includes(t)?'en':'pt';onboarding.draft=d;onboarding.step='review';return reply(`Confira: ${d.name} · ${d.location} · ${d.language.toUpperCase()}. Digite CONFIRMO para criar seu perfil ou CANCELAR para recomeçar.`,{...session,onboarding});
  }
  if(onboarding.step==='review'){
   if(t!=='confirmo'&&t!=='confirm')return reply('Revise seu perfil. Digite CONFIRMO ou CANCELAR.');
   const account={...d,id:crypto.randomUUID(),createdAt:new Date().toISOString(),consent:{purpose:'harvest coordination and buyer availability summaries',version:'v1',acceptedAt:new Date().toISOString()},origin:session.source||'offline-app'};
   const next={...session,account,onboarding:null,draft:{},lastLotId:null,pendingChoice:null};
   if(onboarding.initialHarvest){const r=handleMessage(onboarding.initialHarvest,{...next,draft:{farmer:account.name,location:account.location}},model,context);return {...r,reply:'Perfil salvo. '+r.reply,session:{...r.session,account}};}
   return reply(account.language==='en'?`Profile saved: ${accountSummary(account)}. Send COLHEITA to register a harvest in Portuguese, or ACCOUNT, LOTS, OFFERS, STATUS, SUPPORT. Use Connect WhatsApp / SMS to verify and link your phone account.`:`Perfil salvo: ${accountSummary(account)}. Envie COLHEITA para começar, ou MENU. Use Conectar WhatsApp / SMS para verificar e vincular sua conta.`,next);
  }
 }
 if(session.account&&/^(iniciar|comecar|start|cadastro)$/.test(t))return reply('Seu perfil já está criado. Envie CONTA para revisar ou ALTERAR NOME / ALTERAR LOCAL.');
 if(/^(iniciar|comecar|start|cadastro)$/.test(t)||(!session.account&&/^(ajuda|help|oi|ola|conta|account|menu|colheita|harvest)$/.test(t)))return reply(accountQuestions.consent,{...session,onboarding:{step:'consent',draft:{}},draft:{}});
 if(/^(menu|ajuda|help|oi|ola)$/.test(t))return reply(session.account?.language==='en'?accountMenuEn:accountMenu);
 if(!session.account)return reply(accountQuestions.consent,{...session,draft:{},onboarding:{step:'consent',draft:{},initialHarvest:text}});
 const account=session.account,lots=owned(session,context),choices=(context.choices||[]).filter(c=>lots.some(l=>l.id===c.lotId));
 if(session.pendingAccount){
  if(t!=='confirmo'&&t!=='confirm')return reply('Digite CONFIRMO para salvar a alteração ou CANCELAR.');
  const nextAccount={...account,...session.pendingAccount,updatedAt:new Date().toISOString()};return reply('Perfil atualizado: '+accountSummary(nextAccount)+'. Os lotes anteriores mantêm seus dados originais.',{...session,account:nextAccount,pendingAccount:null});
 }
 if(session.pendingWithdrawal){
  const lot=lots.find(l=>l.id===session.pendingWithdrawal);
  if(!lot||lot.reservedOrderId||choices.some(c=>c.lotId===lot.id))return reply('Este lote precisa de revisão do coordenador. Envie SUPORTE.',{...session,pendingWithdrawal:null});
  if(t!=='confirmo'&&t!=='confirm')return reply('Digite CONFIRMO para retirar o lote da disponibilidade ou CANCELAR.');
  return reply('Lote retirado da disponibilidade. O histórico foi preservado.',{...session,pendingWithdrawal:null},{lotUpdate:{id:lot.id,farmerId:account.id,status:'withdrawn',withdrawnAt:new Date().toISOString()}});
 }
 if(/^(conta|account)$/.test(t))return reply((account.language==='en'?'Your profile: ':'Seu perfil: ')+accountSummary(account)+'. '+(account.language==='en'?accountMenuEn:accountMenu));
 if(/^(lotes|lots)$/.test(t))return reply(lots.length?lots.slice(-8).map(l=>`${l.id.slice(0,8)} · ${l.quantityKg} kg ${crops[l.crop]?.[account.language==='en'?'en':'pt']||l.crop} · ${l.harvestDate} · ${l.status==='withdrawn'?'retirado':'disponível'}${context.offline?' · neste telefone':' · recebido online'}`).join('\n'):'Você ainda não tem lotes neste perfil. Envie COLHEITA.');
 if(/^(status)$/.test(t))return reply(`${account.name}: ${lots.filter(l=>l.status!=='withdrawn').length} lotes disponíveis; ${choices.length} escolhas registradas. ${context.offline?'Registros neste telefone; comprador ainda não recebeu estes dados por este canal.':'Registros recebidos pelo serviço online.'} Remessa aguarda confirmação do comprador e verificação comercial.`);
 if(/^(propostas|offers)$/.test(t))return reply(context.order?`${context.order.label}. ${context.order.quantityKg} kg ${crops[context.order.crop]?.pt||context.order.crop}. Envie COMPARAR GANHOS para seu último lote confirmado. Nenhuma compra confirmada.`:'Nenhuma proposta de comprador disponível. Seu cadastro não garante venda. Envie COLHEITA para registrar disponibilidade.');
 if(/^(exportar|export)$/.test(t))return reply(lots.length?'Seus últimos registros:\n'+lots.slice(-5).map(l=>lotSummary(l)+' ID '+l.id.slice(0,8)).join('\n')+'\nConta: '+accountSummary(account)+'. Para um arquivo completo, use o controle de exportação no telefone.':'Ainda não há lotes para exportar.');
 if(/^(suporte|support)$/.test(t))return reply('Pedido de apoio registrado para revisão. Nenhum atendente foi notificado automaticamente neste protótipo. Guarde seu ID '+account.id.slice(0,8)+'. O coordenador pode revisar a fila no painel.',session,{supportRequest:{id:crypto.randomUUID(),farmerId:account.id,createdAt:new Date().toISOString(),status:'pending',source:session.source||'offline-app'}});
 const edit=/^(?:alterar|change) (nome|local|name|location)\s+(.+)$/i.exec(text.trim());
 if(edit){const value=cleanValue(edit[2]);if(value.length<2||value.length>60)return reply('Use de 2 a 60 caracteres.');return reply(account.language==='en'?`Change ${edit[1]} to ${value}? Send CONFIRMO or CANCEL.`:`Alterar ${edit[1]} para ${value}? Digite CONFIRMO ou CANCELAR.`,{...session,pendingAccount:{[['nome','name'].includes(normal(edit[1]))?'name':'location']:value}});}
 const language=/^(?:idioma|language) (pt|en)$/.exec(t);
 if(language)return reply(language[1]==='en'?'Account menus set to English. Harvest input remains Portuguese in this pilot.':'Idioma da conta: português.',{...session,account:{...account,language:language[1]}});
 const withdraw=/^(?:retirar lote|withdraw lot) ([a-z0-9-]{4,36})$/.exec(t);
 if(withdraw){const matches=lots.filter(l=>l.id.startsWith(withdraw[1])&&l.status!=='withdrawn');if(matches.length!==1)return reply('ID não encontrado ou ambíguo nos seus lotes. Envie LOTES.');const lot=matches[0];if(lot.reservedOrderId||session.pendingChoice?.lotId===lot.id||choices.some(c=>c.lotId===lot.id))return reply('Este lote já tem reserva ou escolha. Envie SUPORTE para revisão.');return reply(`Retirar ${lot.quantityKg} kg do lote ${lot.id.slice(0,8)}? Digite CONFIRMO ou CANCELAR.`,{...session,pendingWithdrawal:lot.id});}
 if(/^(colheita|harvest)$/.test(t))return reply(`O que você tem disponível, ${account.name}? Exemplo: tenho 120 kg de mandioca. Usarei ${account.location}; você pode corrigir na mensagem.`,{...session,draft:{farmer:account.name,location:account.location}});
 const seeded={...session,draft:Object.keys(session.draft||{}).length?session.draft:{farmer:account.name,location:account.location}};
 // Do not seed a harvest draft while comparing or confirming a sales choice.
 const active=(/^(comparar ganhos|escolho (local|proposta)|confirmo|confirm|sim)$/.test(t)||classify(text,model).intent==='earnings')&&!Object.keys(session.draft||{}).length?session:seeded;
 const result=handleMessage(text,{...active,lastLotId:lots.some(l=>l.id===active.lastLotId)?active.lastLotId:null},model,context);
 result.session={...result.session,account};if(result.lot)result.lot={...result.lot,farmerId:account.id,status:'available'};
 return result;
}
