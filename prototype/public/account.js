import {routeAssistant,assistantFollowThrough} from './assistant.js?release=v19';
import {marketMessage} from './marketplace.js?release=v19';
import {languagePrompt,selectLanguage,englishReply} from './conversation-language.js?release=v19';
import {normal,handleMessage,extract,lotSummary,crops,profiles,classify,missing} from './core.js?release=v19';
const accountMenu='COLHEITA · LOTES · PROPOSTAS · STATUS · CONTA · ALTERAR NOME <nome> · ALTERAR LOCAL <cidade> · RETIRAR LOTE <ID> · SUPORTE · EXPORTAR. CONFIRMO salva uma revisão; CANCELAR abandona um rascunho.';
const accountMenuEn='HARVEST · LOTS · OFFERS · STATUS · ACCOUNT · CHANGE NAME <name> · CHANGE LOCATION <town> · WITHDRAW LOT <ID> · SUPPORT · EXPORT. CONFIRM saves a review; CANCEL abandons a draft. COMPARE EARNINGS · CHOOSE LOCAL · CHOOSE PROPOSAL · LANGUAGE EN/PT · DEMO MARKET · MARKET · LOGISTICS · TRADE · HANDOVER.';
const accountQuestions={consent:'Olá! Vamos criar seu perfil. Salvamos seu nome e cidade para registrar colheitas. Um lote confirmado pode ser apresentado a compradores. Não envie documentos ou dados bancários. Digite ACEITO para continuar ou CANCELAR.',name:'Como você prefere ser chamado? Envie somente seu nome.',location:'Em qual cidade ou comunidade você produz? Envie somente o local, sem endereço residencial.',language:languagePrompt};
const cleanValue=s=>s.trim().replace(/^(?:sou|meu nome [ée]|nome:|em|local:)\s+/iu,'');
const accountSummary=a=>`${a.name} · ${a.location} · ${a.language==='en'?'English':'Português'} · ID ${a.id.slice(0,8)}`;
const owned=(session,context)=> (context.lots||[]).filter(l=>l.farmerId===session.account?.id);
function handleFarmerMessageInner(text,session,model,context={}){
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
   if(/^(confirm|confirmo|confirmar|i agree|aceito|start|iniciar|menu|help|ajuda)$/i.test(text.trim()))return reply(accountQuestions[onboarding.step]);
   const value=cleanValue(text);if(value.length<2||value.length>60||!/^[\p{L}\p{N} .,'’-]+$/u.test(value))return reply('Envie um nome ou local de 2 a 60 caracteres.');
   d[onboarding.step]=value;onboarding.draft=d;onboarding.step=onboarding.step==='name'?'location':d.language?'review':'language';return reply(onboarding.step==='review'?`Confira: ${d.name} · ${d.location} · ${d.language.toUpperCase()}. Digite CONFIRMO para criar seu perfil ou CANCELAR para recomeçar.`:accountQuestions[onboarding.step],{...session,onboarding});
  }
  if(onboarding.step==='language'){
   if(!selectLanguage(text))return reply(accountQuestions.language);
   d.language=selectLanguage(text);onboarding.draft=d;if(!d.name){onboarding.step='consent';return reply(accountQuestions.consent,{...session,onboarding,language:d.language});}onboarding.step='review';return reply(`Confira: ${d.name} · ${d.location} · ${d.language.toUpperCase()}. Digite CONFIRMO para criar seu perfil ou CANCELAR para recomeçar.`,{...session,onboarding});
  }
  if(onboarding.step==='review'){
   if(t!=='confirmo'&&t!=='confirm')return reply('Revise seu perfil. Digite CONFIRMO ou CANCELAR.');
   const account={...d,id:crypto.randomUUID(),createdAt:new Date().toISOString(),consent:{purpose:'harvest coordination and buyer availability summaries',version:'v1',acceptedAt:new Date().toISOString()},origin:session.source||'offline-app'};
   const next={...session,account,onboarding:null,draft:{},lastLotId:null,pendingChoice:null};
   if(onboarding.initialHarvest){const r=handleMessage(onboarding.initialHarvest,{...next,draft:{farmer:account.name,location:account.location}},model,context);return {...r,reply:'Perfil salvo. '+r.reply,session:{...r.session,account}};}
   return reply(account.language==='en'?`Profile saved: ${accountSummary(account)}. Send HARVEST to register a harvest, or ACCOUNT, LOTS, OFFERS, STATUS, SUPPORT. Your account is ready to use in this chat. The optional phone companion can be linked for offline access.`:`Perfil salvo: ${accountSummary(account)}. Envie COLHEITA para começar, ou MENU. Use Conectar WhatsApp / SMS para verificar e vincular sua conta.`,next);
  }
 }
 if(session.account&&/^(iniciar|comecar|start|cadastro)$/.test(t))return reply('Seu perfil já está criado. Envie CONTA para revisar ou ALTERAR NOME / ALTERAR LOCAL.');
 if(/^(iniciar|comecar|start|cadastro)$/.test(t)||(!session.account&&/^(ajuda|help|oi|ola|conta|account|menu|colheita|harvest)$/.test(t)))return reply(languagePrompt,{...session,onboarding:{step:'language',draft:{}},draft:{}});
 if(/^(menu|ajuda|help|oi|ola)$/.test(t))return reply(session.account?.language==='en'?accountMenuEn:accountMenu);
 if(!session.account)return reply(languagePrompt,{...session,draft:{},onboarding:{step:'language',draft:{},initialHarvest:text}});
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
 if(edit){const value=cleanValue(edit[2]);if(value.length<2||value.length>60)return reply('Use de 2 a 60 caracteres.');return reply(account.language==='en'?`Change ${edit[1]} to ${value}? Send CONFIRM or CANCEL.`:`Alterar ${edit[1]} para ${value}? Digite CONFIRMO ou CANCELAR.`,{...session,pendingAccount:{[['nome','name'].includes(normal(edit[1]))?'name':'location']:value}});}
 const language=/^(?:idioma|language) (pt|en)$/.exec(t);
 if(language)return reply(language[1]==='en'?'Language set to English.':'Idioma da conta: português.',{...session,account:{...account,language:language[1]}});
 const withdraw=/^(?:retirar lote|withdraw lot) ([a-z0-9-]{4,36})$/.exec(t);
 if(withdraw){const matches=lots.filter(l=>l.id.startsWith(withdraw[1])&&l.status!=='withdrawn');if(matches.length!==1)return reply('ID não encontrado ou ambíguo nos seus lotes. Envie LOTES.');const lot=matches[0];if(lot.reservedOrderId||session.pendingChoice?.lotId===lot.id||choices.some(c=>c.lotId===lot.id))return reply('Este lote já tem reserva ou escolha. Envie SUPORTE para revisão.');return reply(`Retirar ${lot.quantityKg} kg do lote ${lot.id.slice(0,8)}? Digite CONFIRMO ou CANCELAR.`,{...session,pendingWithdrawal:lot.id});}
 if(/^(colheita|harvest)$/.test(t))return reply(`O que você tem disponível, ${account.name}? Exemplo: tenho 120 kg de mandioca. Usarei ${account.location}; você pode corrigir na mensagem.`,{...session,draft:{farmer:account.name,location:account.location}});
 const seeded={...session,draft:Object.keys(session.draft||{}).length?session.draft:{farmer:account.name,location:account.location}};
 // Do not seed a harvest draft while comparing or confirming a sales choice.
 const active=(/^(comparar ganhos|escolho (local|proposta)|confirmo|confirm|sim)$/.test(t)||classify(text,model).intent==='earnings')&&!Object.keys(session.draft||{}).length?session:seeded;
 const result=handleMessage(text,{...active,lastLotId:lots.some(l=>l.id===active.lastLotId)?active.lastLotId:null},model,context);
 result.session={...result.session,account};if(result.lot)result.lot={...result.lot,farmerId:account.id,status:'available'};
 return assistantFollowThrough(result,context);
}

export function handleFarmerMessage(text,session,model,context={}){
 const routed=routeAssistant(text,session,context);if(routed.result)return routed.result;session=routed.session||session;text=routed.command;
 const marketResult=typeof text==='string'?marketMessage(text,session,context):null;
 if(marketResult)return marketResult;
 if(typeof text==='string'&&/^(restart|restart onboarding|recomeçar|recomecar)$/i.test(text.trim())){
  const next={...session,onboarding:session.account?null:{step:'language',draft:{}},draft:{},pendingAccount:null,pendingWithdrawal:null,pendingChoice:null};
  return {reply:languagePrompt,session:next};
 }
 const selected=typeof text==='string'?selectLanguage(text):null;
 // Older conversations may already be mid-onboarding with no language saved.
 // Selecting a language must not be treated as a name or town.
 if(selected&&session.onboarding&&session.onboarding.step!=='language'){
  const onboarding={...session.onboarding,draft:{...session.onboarding.draft,language:selected}};
  if(/^(confirm|confirmo|start|iniciar|menu|help|ajuda)$/i.test(onboarding.draft.name||'')){delete onboarding.draft.name;delete onboarding.draft.location;onboarding.step='name';}
  const prompt=onboarding.step==='review'?`Confira: ${onboarding.draft.name} · ${onboarding.draft.location} · ${selected.toUpperCase()}. Digite CONFIRMO para criar seu perfil ou CANCELAR para recomeçar.`:accountQuestions[onboarding.step];
  return {reply:selected==='en'?englishReply(prompt):prompt,session:{...session,onboarding,language:selected}};
 }
 if(typeof text==='string'&&/^i agree$/i.test(text.trim())&&session.onboarding?.step==='consent')session={...session,language:'en',onboarding:{...session.onboarding,draft:{...session.onboarding.draft,language:'en'}}};
 if(selected&&session.account)return {reply:selected==='en'?'Language set to English. Send MENU for commands.':'Idioma definido: português. Envie MENU.',session:{...session,language:selected,account:{...session.account,language:selected}}};
 if(selected&&!session.account&&!session.onboarding)session={...session,onboarding:{step:'language',draft:{}}};
 const language=selected||session.account?.language||session.onboarding?.draft?.language||session.language;
 let command=text;
 if(language==='en'&&typeof text==='string'){const aliases={'confirm':'CONFIRMO','compare earnings':'comparar ganhos','choose local':'ESCOLHO LOCAL','choose proposal':'ESCOLHO PROPOSTA'};command=aliases[text.trim().toLowerCase()]||text;}
 const result=handleFarmerMessageInner(command,session,model,context),lang=result.session.account?.language||result.session.onboarding?.draft?.language||language;
 if(!lang&&/^(cancel|cancelar)$/i.test(text))result.reply=languagePrompt;
 if(lang==='en'){result.reply=englishReply(result.reply);
 if(/^(export|exportar)$/i.test(text)&&result.session.account){const lots=owned(result.session,context);result.reply=lots.length?'Your recent records:\n'+lots.slice(-5).map(l=>lotSummary(l,'en')+' ID '+l.id.slice(0,8)).join('\n')+'\nUse Export my records in the companion for a full file.':'There are no lots to export yet.';}
 if(result.session.pendingWithdrawal&&/^Retirar /.test(result.reply)){const lot=owned(result.session,context).find(l=>l.id===result.session.pendingWithdrawal);result.reply='Withdraw '+lot.quantityKg+' kg from lot '+lot.id.slice(0,8)+'? Reply CONFIRM or CANCEL.';}
 if(/O que você tem/.test(result.reply))result.reply='What do you have available, '+result.session.account.name+'? For example: I have 120 kg of cassava. Your saved area is '+result.session.account.location+'; you can correct it in your message.';
 const draft=result.session.draft||{};if(!missing(draft).length&&/Responda|Reply CONFIRM/.test(result.reply))result.reply=lotSummary(draft,'en')+' Local price: BRL '+draft.localPriceBrl+'/kg. Reply CONFIRM or correct the details.';
 }
 result.session.assistant=session.assistant;result.session.language=lang;result.session.demoMarketplace=session.demoMarketplace;result.session.marketOrderId=session.marketOrderId;return result;
}

