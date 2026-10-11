(function(root){
'use strict';
function constantArithmetic(formula){
 if(typeof formula!=='string'||!/^=[0-9.()+*/ \-]+$/.test(formula))throw Error('Expressão constante não suportada');
 const tokens=formula.slice(1).match(/[0-9]+(?:\.[0-9]+)?|[()+*/-]/g)||[];let i=0;
 const atom=()=>{if(tokens[i]==='('){i++;const v=add();if(tokens[i++]!==')')throw Error('Parênteses inválidos');return v}if(tokens[i]==='-'){i++;return -atom()}const v=Number(tokens[i++]);if(!Number.isFinite(v))throw Error('Constante inválida');return v};
 const multiply=()=>{let v=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=atom();v=op==='*'?v*b:v/b}return v};
 const add=()=>{let v=multiply();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=multiply();v=op==='+'?v+b:v-b}return v};
 const v=add();if(i!==tokens.length||!Number.isFinite(v))throw Error('Expressão inválida');return v;
}
function configFromCells(sheets){
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const sheet=n=>{const key=Object.keys(sheets).find(k=>norm(k)===norm(n));if(!key)throw Error('Aba ausente: '+n);return sheets[key]};
 const p=sheet('Parametros Construção'),s=sheet('Financiamento_SAC'),f=sheet('Fluxo_Caixa'),r=sheet('Premissas'),h=sheet('Cronograma mensal');
 const raw=(t,a)=>{const x=t[a];if(!x||x.formula)throw Error('Entrada literal esperada: '+a);return x.value};
 const n=(t,a)=>{const v=raw(t,a);if(typeof v!=='number'||!Number.isFinite(v))throw Error('Número esperado: '+a);return v};
 const date=v=>{if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,7);return String(v).slice(0,7)};
 const constants=a=>constantArithmetic(p[a]?.formula);
 const areaExpr=p.B6?.formula?.match(/^=B4\/([0-9.]+)$/);if(!areaExpr)throw Error('Área precisa remapeamento');
 const salary=f.F2?.formula?.match(/^=MIN\(IF\(A2<DATE\((\d+),(\d+),(\d+)\),0,IF\(A2<=DATE\((\d+),(\d+),(\d+)\),([0-9.]+),([0-9.]+)\)\),MAX\(0,([0-9.]+)-\(C2\+E2\+G2-H2\)\)\)$/);if(!salary)throw Error('Regra de salário precisa remapeamento');
 const yearMonth=(y,m)=>y+'-'+String(m).padStart(2,'0');
 const c={principal:n(p,'H3'),construction:n(p,'B4'),land:n(p,'B5'),fgts:n(p,'H4'),premiseFgts:n(r,'B10'),annualInterest:n(p,'H6'),cet:n(p,'H8'),trParameter:n(p,'H9'),term:n(p,'H10'),biennialFgts:n(p,'H11'),monthlyYear1:n(p,'H12'),monthlyYear2:n(p,'H13'),sale:n(p,'K4'),investments:constants('K5'),plr:n(p,'K10'),strategy:raw(p,'K11'),cdiParameter:n(p,'K8'),area:Number(areaExpr[1]),cdbShare:1.05,indicatorNetFactor:.78,tbfFactor:.93,reserveTarget:Number(salary[9]),salaryStart:yearMonth(salary[1],salary[2]),salaryStep:yearMonth(salary[4],salary[5]),salaryFirst:Number(salary[7]),salaryLater:Number(salary[8]),plrCashFactor:1.004,dfi:n(s,'H2'),admin:n(s,'I2'),insurance:n(s,'J2'),firstStage:n(r,'C16'),paidContractor:n(r,'B5'),nextContribution:n(r,'B7'),saleGross:n(r,'B27'),brokerage:n(r,'B28'),expenses:[],dates:[],irFactors:[],ages:[],mipBands:[],trBands:[],cdi:[],stages:[],schedule:[]};
 c.expenses=[['IRPF',n(p,'E4')],['Aluguel e móveis AP',constants('E5')],['Escritura terreno',n(p,'E6')],['CND/ISS',n(p,'E7')],['Habite-se e averbação',n(p,'E8')],['Móveis e equipamentos',constants('E9')],['Portões',n(p,'E10')],['Eletrodomésticos',constants('E11')],['Energia solar',n(p,'E12')]].map(([name,amount],i)=>({id:'excel-extra-'+(i+4),name,amount}));
 for(let i=2;i<=414;i++){c.dates.push(date(raw(s,'A'+i)));c.irFactors.push(n(f,'J'+i));c.ages.push(i<=9?n(s,'O'+i):i<=21?n(s,'O2')+1:c.ages[i-14]+1)}
 for(let i=2;f['L'+i]?.value!==undefined;i++)c.cdi.push({year:n(f,'L'+i),annual:n(f,'M'+i)});
 for(let i=11;i<=15;i++){const age=Number(String(raw(s,'Q'+i)).slice(0,2)),threshold=c.ages.indexOf(age)+1;if(threshold===0)throw Error('Faixa MIP sem idade');c.mipBands.push({threshold,rate:n(s,'R'+i)})}
 for(let i=6;i<=10;i++)c.trBands.push({threshold:n(s,'W'+i),a:n(s,'X'+i),b:n(s,'Y'+i)});
 for(let i=16;i<=22;i++)c.stages.push({name:raw(r,'A'+i),share:n(r,'B'+i),amount:n(r,'C'+i)});
 for(let i=11;i<=23;i++){
  const payment=n(h,'G'+i),fgts=n(h,'J'+i);
  const caixa=i===16?107250-fgts:i===20||i===21||i===23?payment:n(h,'I'+i);
  const own=i===14?constantArithmetic(h['K'+i]?.formula):n(h,'K'+i);
  c.schedule.push({month:date(raw(h,'B'+i)),name:raw(h,'C'+i),services:raw(h,'D'+i),physical:n(h,'E'+i),payment,caixa,fgts,own,condition:raw(h,'L'+i)});
 }
 const furnitureNames=['Móveis','Sofá','Mesa de jantar e gourmet','3 espelhos grandes','5 espelhos pequenos','5 boxes de banheiro','Videoporteiro e fechadura inteligente'];const furniture=p.E9.formula.slice(1).split('+').map(Number);c.legacyCosts=[...furnitureNames.map((name,i)=>[name,furniture[i]]),['Portões',n(p,'E10')],['Eletrodomésticos',constants('E11')],['Energia solar',n(p,'E12')]];
 c.premiseRows=Array.from({length:41},(_,i)=>{const row=i+1;return Array.from({length:6},(_,j)=>{const a=String.fromCharCode(65+j)+row;return {cell:a,label:r[a]?.formula?null:r[a]?.value??null}})});
 c.parameterLabels=Object.fromEntries(Object.entries(p).filter(([a,x])=>/^[ADGJM]\d+$/.test(a)&&typeof x.value==='string').map(([a,x])=>[String.fromCharCode(a.charCodeAt(0)+1)+a.slice(1),x.value]));
 return c;
}
function cellsFromXlsx(book){return Object.fromEntries(book.SheetNames.map(n=>[n,Object.fromEntries(Object.entries(book.Sheets[n]).filter(([a])=>!a.startsWith('!')).map(([a,x])=>[a,{value:x.v instanceof Date?x.v.toISOString():x.v,formula:x.f?'='+x.f:null}]))]))}
function compare(cells,result,tolerance=.01){
 const differences=[],monthly=[];let checked=0,maxDelta=0;
 function check(sheet,cell,actual){const expected=cells[sheet]?.[cell]?.value;if(expected===undefined||expected===null)return;checked++;const numeric=typeof expected==='number';const delta=numeric?Math.abs(expected-actual):0;const a=typeof expected==='string'&&/^\d{4}-\d\d/.test(expected)?String(actual).slice(0,7):actual;const e=typeof expected==='string'&&/^\d{4}-\d\d/.test(expected)?expected.slice(0,7):expected;if(numeric)maxDelta=Math.max(maxDelta,delta);if(numeric?(!Number.isFinite(actual)||delta>tolerance):e!==a)differences.push({sheet,cell,expected,actual,delta});}
 for(const [sheet,rows,cols] of [['Financiamento_SAC',result.sac,'BCDEFGHIJKLMNO'],['Fluxo_Caixa',result.cash,'BCDEFGHIJ']])for(let i=0;i<rows.length;i++){let before=differences.length;for(const col of cols)check(sheet,col+(i+2),rows[i][col]);monthly.push({sheet,month:rows[i].A,divergences:differences.length-before});}
 const pn=Object.keys(cells).find(n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'')==='Parametros Construcao');
 for(const [cell,v] of Object.entries(result.parameters))check(pn,cell,v);
 for(const [cell,v] of Object.entries(result.premises))check('Premissas',cell,v);
 for(let i=0;i<result.schedule.length;i++){const x=result.schedule[i];for(const [col,key] of [['F','physicalTotal'],['H','paymentTotal'],['I','caixa'],['J','fgts'],['K','own']])check('Cronograma mensal',col+(i+11),x[key]);}
 for(const [sheet,values] of [['Financiamento_SAC',result.helperSac],['Fluxo_Caixa',result.helperCash],['Cronograma mensal',result.helperSchedule]])for(const [cell,v] of Object.entries(values))check(sheet,cell,v);
 const mapped={Financiamento_SAC:{...result.helperSac},Fluxo_Caixa:{...result.helperCash},Premissas:result.premises,[pn]:result.parameters,'Cronograma mensal':{...result.helperSchedule}};
 for(const [sheet,rows,cols] of [['Financiamento_SAC',result.sac,'CDEFGHIJKLMNO'],['Fluxo_Caixa',result.cash,'CDEFGHIJ']])rows.forEach((row,i)=>{for(const col of cols)mapped[sheet][col+(i+2)]=row[col]});
 result.schedule.forEach((x,i)=>{for(const [col,key] of [['F','physicalTotal'],['H','paymentTotal'],['I','caixa'],['J','fgts'],['K','own']])mapped['Cronograma mensal'][col+(i+11)]=x[key]});
 const unmapped=[];let formulaCount=0;for(const sheet of Object.keys(mapped))for(const [cell,x] of Object.entries(cells[sheet]))if(x.formula){formulaCount++;if(!Object.hasOwn(mapped[sheet],cell))unmapped.push({sheet,cell,formula:x.formula})}
 return {checked,formulaCount,unmapped,maxDelta,tolerance,differences,monthly,passed:differences.length===0&&unmapped.length===0};
}
root.MinhaObraWorkbook={configFromCells,cellsFromXlsx,compare};if(typeof module!=='undefined')module.exports=root.MinhaObraWorkbook;
})(typeof globalThis!=='undefined'?globalThis:this);
