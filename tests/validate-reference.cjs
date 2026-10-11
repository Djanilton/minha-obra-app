// Input is a private cell map extracted from the user's workbook; do not commit it.
const fs=require('node:fs');const {calculate}=require('../calculation-engine');const {configFromCells,compare}=require('../workbook-adapter');
if(!process.argv[2])throw Error('Uso: node tests/validate-reference.cjs caminho-mapa-privado.json');
const cells=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const result=compare(cells,calculate({...configFromCells(cells),trCapitalizes:false}));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
