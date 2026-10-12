const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,referenceReserve}=require('../calculation-engine');
const {fixture}=require('./fixture');
test('referência da reserva usa fluxo original e não mistura regras atuais',()=>{
 const config={...fixture(),currentFunds:true,constructionMonths:12};
 const before=JSON.stringify(config),r=referenceReserve(config);
 const original=calculate({...config,currentFunds:false,trCapitalizes:false});
 assert.equal(r.parameters.N8,original.parameters.N8);
 assert.equal(r.parameters.N4,original.parameters.N4);
 assert.equal(r.parameters.N8,Math.min(...r.cash.map(x=>x.I)));
 assert.equal(r.parameters.N4,r.cash.find(x=>x.I===r.parameters.N8).A);
 assert.equal(JSON.stringify(config),before);
 assert.notEqual(r.parameters.K6,calculate(config).parameters.K6);
 assert.equal(referenceReserve(null),null);
});
