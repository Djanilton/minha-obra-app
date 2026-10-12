const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{fixture}=require('./fixture');
test('Controle Financeiro publica só duas contas e Minha Obra recebe alterações no mesmo navegador',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
 const context=await browser.newContext(),errors=[],control=await context.newPage(),obra=await context.newPage();
 for(const page of [control,obra])page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://bridge.test/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/control')return route.fulfill({body:`<meta charset="utf-8"><script>
   let data={},settings={},user=null,constructionCache=null;
   const FinanceCore={normalize:s=>String(s).toLowerCase()},Model={investmentRows:()=>[{institution:'Sofisa',month:new Date().toLocaleDateString('sv-SE').slice(0,7),closing:250000,sourceAvailable:true},{institution:'Itaú',month:new Date().toLocaleDateString('sv-SE').slice(0,7),closing:80000,sourceAvailable:true}]};
   function allTransactions(){return []}function projectState(){return null}function dbSet(){return Promise.resolve()}function invalidateModel(){}function login(){}function constructionResult(){}function settingsView(){return ''}function esc(s){return s}function toast(){}function init(){}
   </script><script src="/finance-bridge.js"></script>`,contentType:'text/html'});
  const file=p.slice(1)||'index.html';if(!['index.html','engine-ui.js','calculation-engine.js','workbook-adapter.js','finance-bridge.js'].includes(file))return route.fulfill({status:404,body:''});
  return route.fulfill({body:await fs.readFile(path.join(__dirname,'..',file)),contentType:file.endsWith('.js')?'text/javascript':'text/html'});
 });
 await context.route(/https:\/\/(alcdn|cdn\.jsdelivr)/,r=>r.fulfill({body:''}));
 await control.bringToFront();await control.goto('https://bridge.test/control');await control.waitForFunction(()=>localStorage.getItem('controle-financeiro-saldos-obra-v1'));
 await obra.bringToFront();await obra.goto('https://bridge.test/');await obra.evaluate(c=>{state.meta.engine={config:c,validation:{}};state.meta.landPaid=c.land;state.items.gastos=[{nome:'Construtora — 1ª etapa',categoria:'Construtora',valorPago:140000}];tab='resumo';render()},fixture());
 assert.equal(await obra.evaluate(()=>engineResult().funding.capital),330000);
 assert.equal(await obra.evaluate(()=>engineModel().bankBalances.sofisa),250000);
 await control.bringToFront();await control.evaluate(async()=>{Model.investmentRows=()=>[{institution:'Sofisa',month:new Date().toLocaleDateString('sv-SE').slice(0,7),closing:249000,sourceAvailable:true},{institution:'Itaú',month:new Date().toLocaleDateString('sv-SE').slice(0,7),closing:80000,sourceAvailable:true}];await dbSet('main',data);window.dispatchEvent(new Event('focus'))});
 await control.waitForFunction(()=>JSON.parse(localStorage.getItem('controle-financeiro-saldos-obra-v1')).balances.sofisa===249000,{},{timeout:5000}).catch(async e=>{throw Error(JSON.stringify(await control.evaluate(()=>({snapshot:localStorage.getItem('controle-financeiro-saldos-obra-v1'),data,rows:Model.investmentRows()}))))});await obra.bringToFront();await obra.waitForFunction(()=>JSON.parse(localStorage.getItem('controle-financeiro-saldos-obra-v1')).balances.sofisa===249000);
 assert.equal(await obra.evaluate(()=>engineResult().funding.capital),329000);
 assert.equal(await obra.locator('#summaryReferenceReserve').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
