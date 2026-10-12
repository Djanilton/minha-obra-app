const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {fixture}=require('./fixture');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('valores editáveis propagam para resumo, despesas, cronogramas e cálculo',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://test.minha-obra/**',async route=>{
   const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
   if(!['index.html','calculation-engine.js','workbook-adapter.js','engine-ui.js'].includes(file))return route.fulfill({status:404,body:''});
   await route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.js')?'text/javascript':'text/html'});
  });
  await page.route(/https:\/\/(alcdn|cdn\.jsdelivr)/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await page.goto('https://test.minha-obra/');
  const c=fixture(),shares=[.24,.15,.15,.15,.1,.1,.11];
  c.stages=shares.map((share,i)=>({name:(i+1)+'ª etapa',share,amount:600000*share,startMonth:'2020-01',endMonth:['2020-02','2020-04','2020-06','2020-08','2020-10','2020-12','2021-02'][i]}));
  c.firstStage=c.stages[0].amount;c.expenses[0].name='Móveis';c.premiseRows=Array.from({length:23},()=>Array.from({length:6},()=>({label:''})));
  c.schedule=c.stages.map((x,i)=>({name:x.name,month:x.endMonth,services:'Serviço '+i,physical:shares[i],payment:x.amount,caixa:339000*shares[i],fgts:77000*shares[i],own:184000*shares[i],condition:'Previsto'}));
  const split={...c.schedule[1]};for(const key of ['payment','caixa','fgts','own','physical'])split[key]/=2;c.schedule.splice(1,1,{...split},{...split});
  await page.evaluate(c=>{
   state.meta.engine={config:c,validation:{passed:true,checked:0,formulaCount:0}};
   state.meta.landPaid=100000;
   state.items.etapas=c.stages.map((x,i)=>({id:'stage-'+i,nome:x.name,valor:1,mesInicio:'2025-01',mesFim:'2025-02'}));
   state.items.gastos=[{id:'paid',nome:'Construtora — 1ª etapa',categoria:'Construtora',valor:140000,valorPago:140000}];
   state.items.materiais=[{id:'material',nome:'Acabamento',valorOriginal:1000,valorNovo:2500,valorPago:500}];
   tab='premissas';render();
  },c);
  const end=page.locator('[data-stage="2"][data-column="5"]');
  await end.evaluate(el=>el.dataset.identity='preserved');
  await end.fill('2020-07');await end.dispatchEvent('change');
  assert.equal(await end.getAttribute('data-identity'),'preserved');
  assert.equal(await page.locator('[data-stage="3"][data-column="4"]').inputValue(),'2020-08');
  await page.evaluate(()=>{tab='resumo';render()});
  await page.locator('#summaryHouseExpenses > .sheet-scroll > table > tbody > tr').nth(1).locator('summary').first().click();
  await page.getByText('Etapas',{exact:true}).click();
  const stageRows=page.locator('#summaryHouseExpenses details details table tbody tr');
  assert.match(await stageRows.nth(2).innerText(),/2020-05\s+2020-07/);
  assert.match(await stageRows.nth(3).innerText(),/2020-08/);
  const snapshot=await page.evaluate(()=>({v:consolidatedValues(),r:engineResult(),s:expenseSnapshot()}));
  assert.equal(snapshot.v['Pago compra terreno'],100000);assert.equal(snapshot.v['Compra Terreno'],undefined);assert.equal(snapshot.v['Terreno pago'],undefined);
  for(const row of snapshot.r.schedule){assert.ok(row.own>=0);assert.ok(row.fgts>=0);assert.ok(row.caixa>=0);assert.ok(Math.abs(row.payment-row.own-row.fgts-row.caixa)<.01)}
  assert.match(await page.locator('#summaryFunding').innerText(),/Recursos próprios ainda necessários para a construtora/);
  assert.equal(snapshot.v['Previsão consolidada'],810500);
  assert.equal(snapshot.v['Pago consolidado'],240500);
  assert.ok(Math.abs(snapshot.r.scheduleTotals.construction-601500)<.01);
  assert.ok(Math.abs(snapshot.r.scheduleTotals.caixa-339000)<.01);
  assert.ok(Math.abs(snapshot.r.scheduleTotals.fgts-77000)<.01);
  assert.equal(snapshot.s.stages[3].mesInicio,'2020-08');
  await page.evaluate(()=>{tab='premissas';render()});
  const amount=page.locator('[data-stage="2"][data-column="2"]');
  await amount.fill('120000');await amount.dispatchEvent('change');
  assert.equal(await page.evaluate(()=>expenseSnapshot().contract),630000);
  assert.ok(Math.abs(await page.evaluate(()=>engineResult().scheduleTotals.construction)-631500)<.01);
  await page.locator('[data-stage="1"][data-column="1"]').fill('20');await page.locator('[data-stage="1"][data-column="1"]').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>expenseSnapshot().contract),666000);
  await page.locator('[data-stage="1"][data-column="3"]').fill('11,25% início + 3,75% fim');await page.locator('[data-stage="1"][data-column="3"]').dispatchEvent('change');
  const parts=await page.evaluate(()=>linkedEngineConfig().schedule.filter(x=>stageOrdinal(x.name)==='2').map(x=>x.payment));assert.ok(Math.abs(parts[0]/parts[1]-3)<.0001);
  await page.locator('[data-stage="1"][data-column="6"]').fill('Superestrutura editada');await page.locator('[data-stage="1"][data-column="6"]').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>linkedEngineConfig().schedule.find(x=>stageOrdinal(x.name)==='2').services),'Superestrutura editada');
  await page.locator('#engineParams [name=construction]').fill('720000');
  assert.ok(Math.abs(await page.evaluate(()=>expenseSnapshot().contract)-720000)<.01);
  assert.ok(Math.abs(await page.evaluate(()=>engineResult().scheduleTotals.construction)-721500)<.01);
  await page.locator('#engineParams [name=landPurchase]').fill('260000');
  assert.equal(await page.evaluate(()=>engineResult().parameters.B5),260000);
  await page.locator('#engineParams [name=land]').fill('250000');
  assert.equal(await page.evaluate(()=>expenseSnapshot().land),250000);
  await page.locator('#engineParams [name=saleGross]').fill('710000');
  assert.equal(await page.evaluate(()=>engineResult().parameters.K4),680000);
  assert.equal(await page.locator('#engineParams [name=sale]').inputValue(),'680000');
  await page.locator('#engineParams [name=brokerage]').fill('40000');
  assert.equal(await page.evaluate(()=>engineResult().parameters.K4),670000);
  await page.locator('#engineParams [name=principal]').fill('350000');
  await page.locator('#engineParams [name=fgts]').fill('80000');
  assert.ok(Math.abs(await page.evaluate(()=>engineResult().scheduleTotals.caixa)-350000)<.01);
  assert.ok(Math.abs(await page.evaluate(()=>engineResult().scheduleTotals.fgts)-80000)<.01);
  await page.locator('summary').filter({hasText:'CDI anual e percentual líquido por mês'}).click();
  await page.locator('#engineRates [name=cdi2020]').fill('14.25');
  assert.equal(await page.evaluate(()=>engineResult().parameters.K8),.1425);
  const mutations=await page.evaluate(()=>{
   const base=structuredClone(state.meta.engine.config),result=[];
   for(const [key,value,output] of [['annualInterest',.115,'H6'],['cet',.15,'H8'],['term',360,'H10'],['biennialFgts',25000,'H11'],['sale',650000,'K4'],['investments',80000,'K5'],['plr',10000,'K10']]){
    state.meta.engine.config={...structuredClone(base),[key]:value};result.push([key,engineResult().parameters[output],value]);
   }
   state.meta.engine.config=base;return result;
  });
  for(const [key,actual,expected] of mutations)assert.equal(actual,expected,key);
  const otherFields=await page.evaluate(()=>{
   const base=structuredClone(state.meta.engine.config),answers=[];
   for(const [key,value,read] of [['dfi',75,r=>r.sac[0].H],['admin',35,r=>r.sac[0].I],['insurance',120,r=>r.sac[0].J]]){
    state.meta.engine.config={...structuredClone(base),[key]:value};answers.push([key,read(engineResult()),value]);
   }
   state.meta.engine.config={...structuredClone(base),area:250};answers.push(['area',engineResult().parameters.B6,linkedEngineConfig().construction/250]);
   state.meta.engine.config={...structuredClone(base),reserveTarget:1000000,salaryFirst:3000,salaryLater:4500};const salary=engineResult();answers.push(['salaryFirst: investimento suficiente',salary.cash[3].F,0],['salaryLater: investimento suficiente',salary.cash[16].F,0]);
   state.meta.engine.config={...structuredClone(base),cdbShare:1.15};answers.push(['cdbShare',engineResult().cash[0].D,((1+base.cdi[0].annual*1.15)**(1/12)-1)*base.irFactors[0]]);
   state.meta.engine.config={...structuredClone(base),indicatorNetFactor:.85};answers.push(['indicatorNetFactor',engineResult().parameters.K9,(1+base.cdi[0].annual*base.cdbShare*.85)**(1/12)-1]);
   state.meta.engine.config=base;return answers;
  });
  for(const [key,actual,expected] of otherFields)assert.ok(Math.abs(actual-expected)<1e-7,key);
  await page.evaluate(()=>{tab='gastos';render()});
  await page.locator('input[aria-label^="Valor previsto de"]').first().fill('1234.56');
  await page.locator('input[aria-label^="Valor pago de"]').first().fill('500');
  assert.ok(Math.abs(await page.evaluate(()=>engineResult().extras)-9234.56)<.001);
  assert.match(await page.locator('[data-consolidated="Recursos próprios previstos"]').innerText(),/9\.234,56/);
  await page.evaluate(()=>{state.items.materiais[0].valorPago=750;state.items.materiais[0].valorNovo=3000;persist()});
  assert.equal(await page.evaluate(()=>expenseSnapshot().difference),2000);
  assert.equal(await page.evaluate(()=>expenseSnapshot().materialPaid),750);
  assert.equal(await page.evaluate(()=>engineResult().constructionMonths),14);
  const timeline=await page.evaluate(()=>{const r=engineResult();return {furniture:r.expenseTimeline.findIndex(x=>x.furniture>0),contract:r.expenseTimeline.reduce((a,x)=>a+x.contractor,0),annual:r.annualBalance.reduce((a,x)=>a+x.contractor,0),plan:r.scheduleTotals.construction}});
  assert.equal(timeline.furniture,14);assert.ok(Math.abs(timeline.contract-timeline.plan)<.01);assert.ok(Math.abs(timeline.annual-timeline.plan)<.01);
  const programs=await page.evaluate(()=>{
   const before=engineResult();state.meta.programacoes=[{tipo:'salario',valor:3200,inicio:1,fim:1},{tipo:'extra',valor:700,inicio:1,fim:1}];
   state.items.meses=[{competencia:'2020-01',entrada:100,saida:50}];const after=engineResult();
   return {salary:after.cash[0].F,extra:after.allocation[0].extra,manualIn:after.cash[0].manualIn,manualOut:after.cash[0].manualOut,before:before.cash[0].I,after:after.cash[0].I};
  });
  assert.equal(programs.salary,3200);assert.equal(programs.extra,700);assert.equal(programs.manualIn,100);assert.equal(programs.manualOut,50);assert.notEqual(programs.before,programs.after);
  const cloud=await page.evaluate(()=>{const remote=structuredClone(state);remote.meta.settingsUpdated='2999-01-01';remote.meta.landPaid=260000;remote.meta.engine.config.stages[0].endMonth='2020-03';merge(remote);return {paid:expenseSnapshot().landPaid,second:linkedStageRows()[1].mesInicio}});
  assert.equal(cloud.paid,260000);assert.equal(cloud.second,'2020-04');
  await page.evaluate(()=>persist());await page.reload();
  assert.equal(await page.evaluate(()=>expenseSnapshot().landPaid),260000);
  assert.equal(await page.evaluate(()=>linkedStageRows()[1].mesInicio),'2020-04');
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
