const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,allocateConstructorSources}=require('../calculation-engine');
const {fixture}=require('./fixture');
const close=(a,b)=>assert.ok(Math.abs(a-b)<.000001,`${a} != ${b}`);
test('próprios da construtora são consumidos antes de FGTS e Caixa, sem valores negativos',()=>{
 const payments=[154800,3600,66000,33000,66000,107250,24750,49500,66000,16500,49500,0,23100];
 const rows=payments.map((payment,i)=>({payment,month:String(i).padStart(2,'0'),name:'Pagamento '+i}));
 const r=allocateConstructorSources(rows,{construction:660000,principal:339000,fgts:77000});
 close(r.ownRequired,244000);close(r.schedule.reduce((a,x)=>a+x.own,0),244000);close(r.fgtsUsed,77000);close(r.caixaUsed,339000);
 let ownSpent=0,fgtsSpent=0;
 for(const x of r.schedule){assert.ok(x.own>=0&&x.fgts>=0&&x.caixa>=0);close(x.payment,x.own+x.fgts+x.caixa);if(x.fgts>0)close(ownSpent+x.own,244000);if(x.caixa>0){close(ownSpent+x.own,244000);close(fgtsSpent+x.fgts,77000)}ownSpent+=x.own;fgtsSpent+=x.fgts;}
 close(r.schedule[3].own,19600);close(r.schedule[3].fgts,13400);close(r.schedule[3].caixa,0);
});
test('fontes superiores ao custo e economias de materiais não geram próprios negativos',()=>{
 const a=allocateConstructorSources([{payment:100000,month:'2026-01'}],{construction:100000,principal:339000,fgts:77000});close(a.ownRequired,0);close(a.fgtsUsed,77000);close(a.caixaUsed,23000);
 const b=allocateConstructorSources([{payment:100000,month:'2026-01'},{payment:-1000,month:'2026-02'}],{construction:99000,principal:50000,fgts:20000});close(b.ownRequired,29000);close(b.schedule.reduce((s,x)=>s+x.payment,0),99000);assert.ok(b.schedule.every(x=>x.own>=0));
 assert.throws(()=>allocateConstructorSources([{payment:110000,month:'2026-01'}],{construction:100000,principal:50000,fgts:20000}));
});
test('saldo atual desconta apenas o que falta pagar e mantém móveis parcelados investidos',()=>{
 const c={...fixture(),currentFunds:true,constructionMonths:12,sale:0,investments:60000,landPaid:200000,paidContractorTotal:140000,salaryStart:'2020-01',salaryFirst:10000,salaryLater:10000,reserveTarget:1000000};
 const expenses=c.expenses.map((x,i)=>({...x,name:i===0?'Móveis':x.name,planned:1000,paid:i===0?500:0}));const r=calculate(c,{expenses});
 close(r.funding.ownConstructor,184000);close(r.funding.ownConstructorRemaining,44000);close(r.funding.landRemaining,0);close(r.funding.otherRemaining,8500);close(r.funding.otherUpfront,8000);close(r.funding.afterAll,7500);close(r.funding.startingReserve,8000);close(r.cash[0].C,8000);close(r.parameters.K3,52500);
 close(r.cash[0].F,0);assert.ok(r.cash.some(x=>x.F>0));assert.equal(r.expenseTimeline.findIndex(x=>x.furniture>0),12);
 for(const x of r.cash){close(x.I,x.C+x.E+x.F+x.G+x.manualIn-x.H-x.manualOut-x.deferredPayment+x.unfunded);assert.ok(x.I>=0);close(x.unfunded,0);close(x.paymentFromInvestment+x.paymentFromSalary,x.H);if(x.paymentFromSalary>0)assert.ok(x.paymentFromInvestment<x.H)}
});
test('falta de capital e de salário permanece explícita sem rendimentos sobre saldo negativo',()=>{
 const c={...fixture(),currentFunds:true,constructionMonths:12,sale:0,investments:0,landPaid:200000,paidContractorTotal:140000,salaryStart:'2020-01',salaryFirst:0,salaryLater:0,plr:0};const r=calculate(c,{expenses:[]});
 close(r.funding.initialShortfall,44000);close(r.cash[0].C,0);close(r.cash[0].E,0);assert.ok(r.cash.some(x=>x.unfunded>0));assert.ok(r.cash.every(x=>x.I>=0&&x.E>=0));
});
