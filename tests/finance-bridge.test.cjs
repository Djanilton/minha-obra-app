const test=require('node:test'),assert=require('node:assert/strict');
const bridge=require('../finance-bridge'),engine=require('../calculation-engine'),{fixture}=require('./fixture');
test('saldos bancários atuais substituem investimento e não somam venda histórica',()=>{
 const s={version:1,asOf:'2020-04',updatedAt:'2020-04-01T00:00:00Z',balances:{sofisa:250000,itau:80000}},original=fixture(),c=bridge.apply(original,s);
 assert.equal(c.investments,330000);assert.equal(original.investments,60000);assert.equal(c.projectionStart,'2020-04');
 const r=engine.calculate({...c,landPaid:200000,paidContractorTotal:140000});
 assert.equal(r.funding.capital,330000);assert.equal(r.cash[0].I,r.parameters.K6);assert.equal(r.cash[0].E,0);assert.equal(r.cash[2].historical,true);assert.equal(r.cash[3].historical,undefined);
 const other=engine.calculate({...c,sale:9999999,landPaid:200000,paidContractorTotal:140000});assert.equal(other.parameters.K6,r.parameters.K6);
 assert.throws(()=>bridge.apply(original,{...s,balances:{sofisa:250000}}));
});
test('déficit permanece negativo nos indicadores mesmo sem saldo bancário negativo',()=>{
 const r=engine.calculate({...fixture(),currentFunds:true,investments:0,landPaid:200000,paidContractorTotal:140000,salaryFirst:0,salaryLater:0,plr:0});
 assert.ok(r.parameters.N8<0);assert.ok(r.parameters.P5);assert.ok(r.cash.every(x=>x.I>=0));
});
test('parcela do mês já paga não é descontada novamente do saldo atual',()=>{
 const c={...fixture(),currentFunds:true,projectionStart:'2020-04',investments:330000,landPaid:200000,paidContractorTotal:140000},base=engine.calculate(c),paid=engine.calculate({...c,paidInstallmentCurrent:300});
 assert.equal(base.cash[3].H-paid.cash[3].H,300);
 assert.ok(Math.abs(paid.cash[3].I-base.cash[3].I-300)<.000001);
 assert.equal(paid.cash[3].paidCurrent,300);
});
