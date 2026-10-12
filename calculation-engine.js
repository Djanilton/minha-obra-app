/* Explicit workbook migration. No Excel formula evaluation or cached outputs. */
(function(root){
'use strict';
const sum=a=>a.reduce((s,v)=>s+v,0);
function number(v,name){if(typeof v!=='number'||!Number.isFinite(v))throw Error('Parâmetro inválido: '+name);return v}
function month(v){return String(v).slice(0,7)}
function previous(table,key){const eligible=table.filter(x=>x.threshold<=key);if(!eligible.length)throw Error('Tabela sem faixa para '+key);return eligible.reduce((a,b)=>a.threshold>b.threshold?a:b)}

function allocateConstructorSources(schedule,{construction,principal,fgts}){
 const cents=v=>Math.round(Number(v||0)*100),budget=cents(construction),credit=cents(principal),fund=cents(fgts);if(budget<0||credit<0||fund<0)throw Error('Fontes ou custo da construtora inválidos');
 const rows=schedule.map(x=>({...x})).sort((a,b)=>String(a.month).localeCompare(String(b.month)));let adjustment=0;for(const x of rows){const value=cents(x.payment);if(value<0){adjustment-=value;x.payment=0;x.condition=(x.condition||'')+' · economia considerada no total'}else x.payment=value/100}for(let i=rows.length-1;i>=0&&adjustment>0;i--){const used=Math.min(cents(rows[i].payment),adjustment);rows[i].payment=(cents(rows[i].payment)-used)/100;adjustment-=used}const total=rows.reduce((a,x)=>a+cents(x.payment),0);if(adjustment||Math.abs(total-budget)>1)throw Error('Pagamentos do cronograma não fecham com o custo da construtora');
 let own=Math.max(0,budget-credit-fund),fgtsLeft=fund,creditLeft=credit;const ownRequired=own/100;for(const x of rows){let amount=cents(x.payment);const usedOwn=Math.min(amount,own);own-=usedOwn;amount-=usedOwn;const usedFgts=Math.min(amount,fgtsLeft);fgtsLeft-=usedFgts;amount-=usedFgts;const usedCredit=Math.min(amount,creditLeft);creditLeft-=usedCredit;amount-=usedCredit;x.own=usedOwn/100;x.fgts=usedFgts/100;x.caixa=usedCredit/100;x.sourceGap=amount/100;if(amount)throw Error('Faltam fontes para pagar a construtora')}return {schedule:rows,ownRequired,fgtsUsed:(fund-fgtsLeft)/100,caixaUsed:(credit-creditLeft)/100,unusedFgts:fgtsLeft/100,unusedCredit:creditLeft/100}
}

function calculate(c,{expenses=null,programs=[],movements=[]}={}){
 if(!Number.isFinite(c.principal)||c.principal<=0)throw Error('Informe um financiamento maior que zero');
 for(const k of ['construction','land','fgts','annualInterest','term','sale','investments','plr','biennialFgts','dfi','admin','insurance','area','reserveTarget'])number(c[k],k);
 if(c.term<1||!Number.isInteger(c.term)||c.annualInterest<=-1||c.area<=0)throw Error('Prazo, taxa ou área inválidos');
 const extras=expenses===null?sum(c.expenses.map(x=>number(x.amount,x.name))):sum(expenses.map(x=>number(x.planned,x.name)));
 const p={B3:c.construction+c.land,B4:c.construction,B5:c.land,E3:extras,H3:c.principal,H4:c.fgts,H6:c.annualInterest,H8:c.cet,H9:c.trParameter,H10:c.term,H11:c.biennialFgts,H12:c.monthlyYear1,H13:c.monthlyYear2,K4:c.sale,K5:c.investments,K8:c.cdiParameter,K10:c.plr,K11:c.strategy};
 p.H5=p.B3-p.H3-p.H4;p.K3=p.H5+extras;p.K6=p.K4+p.K5-p.K3;p.B6=p.B4/c.area;p.B7=p.B3/c.area;p.H7=(1+p.H6)**(1/12)-1;p.K9=(1+p.K8*c.cdbShare*c.indicatorNetFactor)**(1/12)-1;
 const constructionMonths=c.trCapitalizes===false?0:(c.constructionMonths??12);
 if(!Number.isInteger(constructionMonths)||constructionMonths<0||constructionMonths>=c.term)throw Error("Prazo de obra inválido");
 const releaseWeights=Array(constructionMonths).fill(0);if(constructionMonths){for(const x of c.schedule){let idx=c.dates.findIndex(d=>month(d)>=month(x.month));idx=Math.max(0,Math.min(constructionMonths-1,idx<0?constructionMonths-1:idx));releaseWeights[idx]+=Math.max(0,x.caixa)}if(!sum(releaseWeights))releaseWeights.fill(1)}
 const releases=releaseWeights.map(x=>c.principal*x/sum(releaseWeights));
 const costRows=expenses===null?c.expenses.map(x=>({...x,planned:x.amount,paid:0})):expenses;
 const deferred=c.trCapitalizes===false?0:sum(costRows.filter(x=>/m[oó]veis|eletro|sof[aá]|espelho|box|videoporteiro|fechadura|mesa/i.test(x.name)).map(x=>Math.max(0,x.planned-(x.paid||0))));
 p.K6+=deferred;
 const currentFunds=c.currentFunds===true;const ownConstructor=Math.max(0,c.construction-c.principal-c.fgts),constructorAlreadyPaid=Math.min(ownConstructor,Math.max(0,Number(c.paidContractorTotal??c.paidContractor??0))),ownConstructorRemaining=Math.max(0,ownConstructor-constructorAlreadyPaid),landRemaining=Math.max(0,c.land-Number(c.landPaid||0)),otherRemaining=sum(costRows.map(x=>Math.max(0,x.planned-Number(x.paid||0)))),otherUpfront=Math.max(0,otherRemaining-deferred),capital=c.sale+c.investments;
 const funding={currentFunds,capital,ownConstructor,constructorAlreadyPaid,ownConstructorRemaining,landRemaining,otherRemaining,otherUpfront,deferred,afterConstructor:capital-ownConstructorRemaining,afterAll:capital-ownConstructorRemaining-landRemaining-otherRemaining,initialShortfall:0};
 if(currentFunds){p.H5=ownConstructorRemaining+landRemaining;p.K3=ownConstructorRemaining+landRemaining+otherRemaining;const opening=capital-ownConstructorRemaining-landRemaining-otherUpfront;funding.initialShortfall=Math.max(0,-opening);p.K6=Math.max(0,opening)}funding.startingReserve=p.K6;
 const expenseTimeline=[];
 const sac=[],cash=[],allocation=[];let debt=constructionMonths?0:c.principal,reserve=p.K6;
 for(let i=0;i<c.dates.length;i++){
  const m=i+1,date=month(c.dates[i]),year=Number(date.slice(0,4)),mo=Number(date.slice(5,7));
  const annual=c.cdi.find(x=>x.year===year)?.annual;if(annual===undefined)throw Error('CDI não informado para '+year);
  number(annual,'CDI '+year);if(annual<=-1||!Number.isFinite(c.cdbShare)||c.cdbShare<=0)throw Error('CDI ou rendimento do CDB inválido');
  const factor=number(c.irFactors[i],'IR mês '+m),gross=(1+annual*c.cdbShare)**(1/12)-1,net=gross*factor;
  let tr=0;if(i>0){const tbf=gross/c.cdbShare*c.tbfFactor,band=previous(c.trBands,tbf);tr=Math.max(0,(1+tbf)/(band.a+band.b*tbf)-1)}
  const inConstruction=i<constructionMonths,release=inConstruction?releases[i]:0;
  if(i>0)debt=Math.round(debt)<=0?0:debt;debt+=release;
  const correctedDebt=debt*(c.trCapitalizes===false?1:1+tr);
  const interest=debt<=0?0:debt*(1+tr)*p.H7,amortization=debt<=0||inConstruction?0:correctedDebt/(c.term-m+1);
  if(!Number.isFinite(amortization)||amortization<0)throw Error('Saldo remanescente após o prazo');
  const mip=debt<=0?0:correctedDebt*previous(c.mipBands,m).rate,insurance=i===0?c.insurance:debt<=0?0:correctedDebt*c.insurance/c.principal;
  const fgts=!inConstruction&&debt>0&&m%24===0?c.biennialFgts*(1+sum([...sac.slice(Math.max(0,i-11)).map(x=>x.D),tr])):0;
  const plrDebt=!inConstruction&&debt>0&&c.strategy==='Finan'&&m%12===0?c.plr:0;
  for(const x of programs)if(!Number.isFinite(x.valor)||x.valor<0||!Number.isInteger(x.inicio)||!Number.isInteger(x.fim)||x.inicio<1||x.fim<x.inicio)throw Error('Programação de aporte inválida');
  const scheduled=programs.filter(x=>m>=x.inicio&&m<=x.fim);
  const requestedDebtPrograms=sum(scheduled.filter(x=>x.tipo==='amortizacao').map(x=>number(x.valor,'aporte')));
  const debtPrograms=inConstruction?0:requestedDebtPrograms;
  // Compare marginal savings: fixed DFI/admin do not fall with a partial amortization.
  const financeRate=debt>0?((1+tr)*(1+p.H7)-1)+(1+tr)*previous(c.mipBands,m).rate:0;
  const destination=!inConstruction&&debt>0&&net<=financeRate?'amortizacao':'investimento';
  const autoAmount=sum(scheduled.filter(x=>x.tipo==='automatico'||x.tipo==='extra'&&c.autoExtras!==false).map(x=>x.valor));
  const autoDebt=destination==='amortizacao'?autoAmount:0;
  const availableDebt=Math.max(0,correctedDebt-amortization);
  const baseDebt=Math.min(availableDebt,fgts+plrDebt+debtPrograms);
  const appliedAutoDebt=Math.min(Math.max(0,availableDebt-baseDebt),autoDebt);
  const parkedDebt=inConstruction?requestedDebtPrograms:0;
  const autoCash=autoAmount-appliedAutoDebt+parkedDebt;
  allocation.push({month:date,investmentRate:net,financeRate,destination,phase:inConstruction?'Construção':'Amortização',extra:autoAmount+parkedDebt,toDebt:appliedAutoDebt,toInvestment:autoCash});
  const extra=debt<=0?0:Math.min(c.trCapitalizes===false?debt+tr+interest+amortization:Math.max(0,correctedDebt-amortization),fgts+plrDebt+debtPrograms+appliedAutoDebt);
  const installment=(debt<=0?(inConstruction?c.dfi+c.admin:0):interest+amortization+mip+c.dfi+c.admin)+(inConstruction?correctedDebt-debt:0);
  const closing=debt<=0?0:Math.max(0,(inConstruction?debt:correctedDebt)-amortization-extra);
  const age=c.ages[i];
  const s={A:date,B:m,C:debt,D:tr,E:interest,F:amortization,G:mip,H:c.dfi,I:c.admin,J:insurance,K:extra,L:installment,M:closing,N:!inConstruction&&closing===0?'Sim':'Não',O:age,phase:inConstruction?'Construção':'Amortização',release,correction:correctedDebt-debt,correctedDebt};
  sac.push(s);
  const earnings=(currentFunds?Math.max(0,reserve):reserve)*net,plrCash=c.strategy==='CDB'&&mo===4?c.plr*c.plrCashFactor:inConstruction&&c.strategy==='Finan'&&m%12===0?c.plr:0;
  const baseSalary=date<c.salaryStart?0:date<=c.salaryStep?c.salaryFirst:c.salaryLater;
  const salProgram=sum(scheduled.filter(x=>x.tipo==='salario').map(x=>number(x.valor,'salário'))),extraProgram=sum(scheduled.filter(x=>x.tipo==='extra'&&c.autoExtras===false).map(x=>number(x.valor,'aporte extra')));
  const manual=movements.filter(x=>month(x.competencia)===date),manualIn=sum(manual.map(x=>Number(x.entrada)||0)),manualOut=sum(manual.map(x=>Number(x.saida)||0));
  const furnitureMonth=i-constructionMonths;const deferredPayment=furnitureMonth>=0&&furnitureMonth<8?(furnitureMonth===7?deferred-Math.round(deferred/8*100)/100*7:Math.round(deferred/8*100)/100):0;
  const availableInvestment=Math.max(0,reserve)+earnings+plrCash+extraProgram+autoCash+manualIn;
  const salaryNeed=currentFunds?Math.max(0,installment+deferredPayment+manualOut-availableInvestment):Math.max(0,c.reserveTarget-(reserve+earnings+plrCash-installment));
  const salary=Math.min(baseSalary,salaryNeed);
  // Explicit salary programs replace the automatic capped salary only in their range.
  const appliedSalary=scheduled.some(x=>x.tipo==='salario')?salProgram:salary;
  const distribution=allocation[i];
  distribution.totalToDebt=extra;distribution.totalToInvestment=appliedSalary+plrCash+extraProgram+autoCash;distribution.contributionTotal=distribution.totalToDebt+distribution.totalToInvestment;
  distribution.sources=[...(appliedSalary>0?['Salário']:[]),...(fgts>0?['FGTS']:[]),...(plrDebt>0||plrCash>0?['PLR']:[]),...(autoAmount>0||extraProgram>0?['Extra programado']:[]),...(requestedDebtPrograms>0?['Amortização programada']:[])];
  const contractorPayment=sum(c.schedule.filter(x=>month(x.month)===date).map(x=>x.payment));
  const ownPayment=(i===0?(currentFunds?otherUpfront:extras-deferred):0)+deferredPayment;
  const appliedFgts=Math.min(fgts,extra);
  const ownContributions=appliedSalary+plrCash+extraProgram+autoCash+Math.max(0,extra-appliedFgts);
  const financingFlow=installment+appliedFgts,ownFlow=ownPayment+ownContributions;
  expenseTimeline.push({month:date,financing:financingFlow,contractor:contractorPayment,own:ownFlow,total:financingFlow+contractorPayment+ownFlow,furniture:deferredPayment,salary:appliedSalary,plr:plrCash+Math.min(plrDebt,Math.max(0,extra-appliedFgts)),fgts:appliedFgts,ownExpenses:ownPayment,ownContributions});
  const rawReserve=reserve+earnings+appliedSalary+plrCash+extraProgram+autoCash+manualIn-installment-manualOut-deferredPayment,unfunded=currentFunds?Math.max(0,-rawReserve):0,finalReserve=currentFunds?Math.max(0,rawReserve):rawReserve;
  const paymentFromInvestment=Math.min(installment,Math.max(0,availableInvestment)),paymentFromSalary=Math.min(Math.max(0,installment-paymentFromInvestment),appliedSalary);
  cash.push({A:date,B:m,C:reserve,D:net,E:earnings,F:appliedSalary,G:plrCash+extraProgram+autoCash,H:installment,I:finalReserve,J:factor,manualIn,manualOut,deferredPayment,unfunded,paymentFromInvestment,paymentFromSalary});
  debt=closing;reserve=finalReserve;
 }
 const paidIndex=sac.findIndex((x,i)=>i>=constructionMonths&&x.M===0),paidMonths=paidIndex<0?null:paidIndex+1;
 const minReserve=Math.min(...cash.map(x=>x.I)),interestTotal=sum(sac.map(x=>x.E)),totalPaid=sum(sac.map(x=>x.K+x.L));
 p.N6=paidMonths;p.N7=paidMonths===null?null:paidMonths/12;p.N8=minReserve;p.N4=cash.find(x=>x.I===minReserve)?.A;p.P5=cash.find(x=>x.I<0)?.A||'';
 // Legacy N3 is one row early; preserve separately for reconciliation.
 p.N3=paidIndex<0?null:sac[c.trCapitalizes===false&&c.legacyPayoffIndex?Math.max(0,paidIndex-1):paidIndex].A;p.N5=paidIndex>0?sac[paidIndex-1].O:null;p.N9=paidIndex<0?null:cash[paidIndex].I;p.N10=interestTotal;p.N11=totalPaid;p.H14=totalPaid-c.principal;p.K7=p.K3+totalPaid;
 p.N12=totalPaid===0?null:1-c.principal/totalPaid;p.N13=paidMonths===null?null:-interestTotal-500*paidMonths+p.N9;p.N14=(1+p.H7)**12-1;p.N15=(1+p.K9)**12-1;p.N16=p.N15>p.N14?'Investir':'Amortizar';p.N17=p.N9===null?null:p.N9<20000?100000:0;p.N18=paidMonths===null?null:-interestTotal-300*paidMonths+p.N9*.8-p.N17;
 let physical=0,paid=0;const schedule=c.schedule.map(x=>{physical+=x.physical;paid+=x.payment;return {...x,physicalTotal:physical,paymentTotal:paid,sourceGap:x.payment-x.caixa-x.fgts-x.own}});
 const scheduleTotals={construction:sum(schedule.map(x=>x.payment)),caixa:sum(schedule.map(x=>x.caixa)),fgts:sum(schedule.map(x=>x.fgts)),own:sum(schedule.map(x=>x.own))};scheduleTotals.gap=scheduleTotals.construction-scheduleTotals.caixa-scheduleTotals.fgts-scheduleTotals.own;
 const prem={B4:c.construction,B5:c.paidContractor,B7:c.nextContribution,B9:c.principal,B10:c.premiseFgts,B12:c.land,B27:c.saleGross,B28:c.brokerage,B6:c.firstStage-c.paidContractor,B8:c.firstStage-c.paidContractor-c.nextContribution,B11:c.construction-c.principal-c.premiseFgts,B13:c.construction+c.land,B23:sum(c.stages.map(x=>x.amount)),B24:sum(c.stages.map(x=>x.share)),B29:c.saleGross-c.brokerage};
 const helperSac={P2:Math.max(0,((1+cash[0].D*.95)**12-1-.08)*.006),Q2:sac[0].E/c.principal,R2:sac[0].G/c.principal,S2:c.dfi/c.principal,T2:c.admin/c.principal,U2:c.insurance/c.principal,V2:sac[0].F/c.principal,S3:c.dfi/p.B3,V14:previous(c.trBands,.015).b};
 for(let i=6;i<=10;i++)helperSac['S'+i]=0;c.mipBands.forEach((x,i)=>helperSac['T'+(i+11)]=x.threshold);
 const helperCash={};c.cdi.forEach((x,i)=>helperCash['N'+(i+2)]=(1+x.annual*c.cdbShare)**(1/12)-1);[.225,.2,.175,.15].forEach((v,i)=>helperCash['R'+(i+2)]=1-v);
 [4,5,6,7,8,9,10,11,12].forEach((r,i)=>p['E'+r]=expenses===null?c.expenses[i].amount:(expenses.find(x=>x.id===c.expenses[i].id||x.name===c.expenses[i].name)?.planned??0));
 const annualBalanceMap=new Map();expenseTimeline.forEach((x,i)=>{const year=x.month.slice(0,4);if(!annualBalanceMap.has(year))annualBalanceMap.set(year,{year,investment:0,salary:0,plr:0,fgts:0,extras:0,caixaRelease:0,caixa:0,contractor:0,others:0});const y=annualBalanceMap.get(year),a=cash[i],s=sac[i];y.investment+=a.E;y.salary+=x.salary;y.plr+=x.plr;y.fgts+=x.fgts+sum(c.schedule.filter(z=>month(z.month)===x.month).map(z=>z.fgts));y.extras+=Math.max(0,x.ownContributions-x.salary-x.plr)+a.manualIn;y.caixaRelease+=s.release;y.caixa+=s.L+s.K;y.contractor+=x.contractor;y.others+=x.ownExpenses+a.manualOut;});const annualBalance=[...annualBalanceMap.values()].map(x=>({...x,sources:x.investment+x.salary+x.plr+x.fgts+x.extras+x.caixaRelease,destinations:x.caixa+x.contractor+x.others,net:x.investment+x.salary+x.plr+x.fgts+x.extras+x.caixaRelease-x.caixa-x.contractor-x.others}));
 const helperSchedule={B5:scheduleTotals.construction,B6:scheduleTotals.caixa,B7:scheduleTotals.fgts,B8:scheduleTotals.own,E5:physical,E6:paid,E7:scheduleTotals.construction-paid,E8:scheduleTotals.gap};
 return {funding,constructionMonths,releases,deferred,expenseTimeline,annualBalance,parameters:p,premises:prem,sac,cash,allocation,schedule,scheduleTotals,extras,helperSac,helperCash,helperSchedule,payoff:paidIndex<0?null:sac[paidIndex].A,warnings:[...(scheduleTotals.construction!==c.construction?['Valores literais do cronograma divergem do contrato atualizado']:[]),...(scheduleTotals.fgts!==c.fgts?['FGTS do cronograma difere do cenário']:[]),...(scheduleTotals.gap!==0?['Cronograma: diferença de fontes '+scheduleTotals.gap]:[]),...(c.fgts!==c.premiseFgts?['FGTS diverge entre abas']:[]),...(constructionMonths?['Obra estimada em '+constructionMonths+' meses: liberações proporcionais ao cronograma, ajustadas ao principal; encargos variáveis, sem parcela fixa de R$1.500. TR paga nos encargos durante obra; sem amortização regular. Extras e amortizações programadas ficam investidos até a conclusão. MIP usa o saldo liberado como aproximação.']:[]),'TR corrige o saldo antes de juros, amortização e MIP. J (seguros/FGHAB) não integra a parcela L.','H9, H12 e H13 não alimentam as fórmulas mensais da origem.']};
}
function referenceReserve(config){if(!config)return null;return calculate({...structuredClone(config),currentFunds:false,trCapitalizes:false},{programs:[],movements:[]})}
root.MinhaObraEngine={calculate,allocateConstructorSources,referenceReserve};if(typeof module!=='undefined')module.exports=root.MinhaObraEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
