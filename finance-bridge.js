/* Only private browser storage and the user's OneDrive contain account balances. */
(function(root){
'use strict';
const KEY='controle-financeiro-saldos-obra-v1',FILE='controle-financeiro-saldos-obra.json';
function valid(s){return s?.version===1&&/^\d{4}-\d{2}$/.test(s.asOf)&&['sofisa','itau'].every(k=>Number.isFinite(s.balances?.[k]))&&Number.isFinite(Date.parse(s.updatedAt))}
function apply(c,s){if(!valid(s))throw Error('Saldos dos investimentos incompletos');return {...c,investments:s.balances.sofisa+s.balances.itau,bankBalances:{...s.balances},projectionStart:s.asOf,paidInstallmentCurrent:Number(s.paidInstallmentCurrent||0),investmentSourceUpdated:s.updatedAt,currentFunds:true}}
root.ObraFinanceBridge={valid,apply};
if(typeof module!=='undefined'){module.exports=root.ObraFinanceBridge;return}
const isControl=typeof data!=='undefined'&&typeof Model!=='undefined';let running=false;
function cache(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function newer(s,t){return valid(s)&&(!valid(t)||Date.parse(s.updatedAt)>Date.parse(t.updatedAt))}
function account(){return typeof user!=='undefined'?user?.username:null}
async function controlSnapshot(){
 const asOf=new Date().toLocaleDateString('sv-SE').slice(0,7),tx=allTransactions().filter(x=>x.paymentDate||FinanceCore.normalize(x.status)==='efetivada');
 const rows=Model.investmentRows(tx,data.initialBalances||[],data.sourceTables||{},{from:'2000-01',to:asOf,asOf});
 const sofisa=rows.find(x=>x.institution==='Sofisa'&&x.month===asOf),itau=rows.find(x=>x.institution==='Itaú'&&x.month===asOf);
 if(!sofisa?.sourceAvailable||!itau?.sourceAvailable)return null;
 const balances={sofisa:sofisa.closing,itau:itau.closing},old=cache(),paidInstallmentCurrent=typeof Model.financingTransactions==='function'?Model.financingTransactions(tx).filter(x=>String(x.paymentDate||x.date||x.dueDate).slice(0,7)===asOf).reduce((a,x)=>a+Number(x.amount||0),0):0;
 if(valid(old)&&old.asOf===asOf&&JSON.stringify(old.balances)===JSON.stringify(balances)&&old.paidInstallmentCurrent===paidInstallmentCurrent&&old.account===account())return old;
 const s={version:1,asOf,balances,paidInstallmentCurrent,updatedAt:new Date().toISOString(),account:account(),source:'Controle Financeiro — saldos realizados'};if(!valid(s))return null;localStorage.setItem(KEY,JSON.stringify(s));return s;
}
async function putSnapshot(s){
 if(!user)return;
 // Silent only: the regular Microsoft sign-in requests the write scope.
 const authResult=await auth.acquireTokenSilent({account:user,scopes:['User.Read','Files.ReadWrite']});
 const url='https://graph.microsoft.com/v1.0/me/drive/root:/'+FILE+':/content',headers={Authorization:'Bearer '+authResult.accessToken};
 const old=await fetch(url.replace(':/content',''),{headers});let etag;
 if(old.ok){const metadata=await old.json();etag=metadata.eTag;const response=await fetch(url,{headers});if(!response.ok)throw Error('Não foi possível ler os saldos privados');const remote=await response.json();if(newer(remote,s))return}
 else if(old.status!==404)throw Error('Não foi possível consultar os saldos privados');
 const h={...headers,'Content-Type':'application/json'};if(etag)h['If-Match']=etag;else h['If-None-Match']='*';
 const response=await fetch(url,{method:'PUT',headers:h,body:JSON.stringify(s)});if(!response.ok)throw Error('Saldos não sincronizados: HTTP '+response.status);
}
function adopt(s){
 if(!valid(s)||(s.account&&account()&&s.account!==account()))return false;
 if(isControl)return false;
 const c=engineModel();if(!c)return false;
 if(c.investmentSourceUpdated&&Date.parse(c.investmentSourceUpdated)>=Date.parse(s.updatedAt))return false;
 state.meta.engine.config=apply(c,s);state.meta.financialBalances=s;persist();return true;
}
async function sync(force=false){if(running){if(force)setTimeout(()=>sync(true),100);return}if(document.hidden&&!force)return;running=true;try{
 if(isControl){const s=await controlSnapshot();if(s){const project=projectState();if(project?.meta?.engine?.config){project.meta.engine.config=apply(project.meta.engine.config,s);constructionCache=null;settings.constructionOverrides={...settings.constructionOverrides,investments:s.balances.sofisa+s.balances.itau};invalidateModel();if(typeof renderConstructionChange==='function')renderConstructionChange()}if(user)await putSnapshot(s)}}
 else{adopt(cache());if(user){const remote=await graph('/me/drive/root:/'+FILE+':/content');if(newer(remote,cache()))localStorage.setItem(KEY,JSON.stringify(remote));adopt(remote)}}
 }catch(e){if(isControl)data.financialBridgeError=e.message;else state.meta.financialBridgeError=e.message}finally{running=false}}
if(isControl){
 const priorSettings=settingsView;settingsView=function(){const s=cache();return priorSettings()+'<article class="card"><h2>Saldos compartilhados com Minha Obra</h2><p>Somente Sofisa e Investimento Itaú. Atualização ao abrir, importar ou alterar os dados e a cada 2 minutos.</p><p>'+(valid(s)?'Saldos atualizados em '+esc(new Date(s.updatedAt).toLocaleString('pt-BR')):'Aguardando os saldos realizados das duas contas.')+'</p><p>'+esc(data.financialBridgeError||'')+'</p><p class="fine">Para compartilhar entre dispositivos, entre com Microsoft e permita a gravação do arquivo privado de saldos no OneDrive.</p></article>'};
 const oldDbSet=dbSet;dbSet=async function(key,value){await oldDbSet(key,value);if(key==='main')setTimeout(()=>sync(true),0)};
 const oldLogin=login;login=async function(){await oldLogin();if(user)try{await auth.acquireTokenPopup({account:user,scopes:['User.Read','Files.ReadWrite']});await sync()}catch(e){toast('Vínculo dos saldos: '+e.message)}};
 const oldResult=constructionResult;constructionResult=function(){const s=cache(),p=projectState();if(valid(s)&&p?.meta?.engine?.config&&p.meta.engine.config.investmentSourceUpdated!==s.updatedAt){p.meta.engine.config=apply(p.meta.engine.config,s);constructionCache=null;settings.constructionOverrides={...settings.constructionOverrides,investments:s.balances.sofisa+s.balances.itau}}return oldResult()};
 const oldInit=init;init=async function(){await oldInit();await sync()};
}else{
 const oldRefresh=refreshCloud;refreshCloud=async function(){await oldRefresh();await sync()};
 const oldResult=engineResult;engineResult=function(){adoptWithoutRender(cache());return oldResult()};
 function adoptWithoutRender(s){if(!valid(s)||(s.account&&account()&&s.account!==account()))return;const c=engineModel();if(c&&(!c.investmentSourceUpdated||Date.parse(s.updatedAt)>Date.parse(c.investmentSourceUpdated)||c.investments!==s.balances.sofisa+s.balances.itau)){state.meta.engine.config=apply(c,s);state.meta.financialBalances=s;engineStamp();localStorage.setItem(STORAGE,JSON.stringify(state));dirty=true;scheduleSync()}}
}
window.addEventListener('storage',e=>{if(e.key===KEY)sync()});window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(sync,120000);setTimeout(sync,0);
})(typeof globalThis!=='undefined'?globalThis:this);
