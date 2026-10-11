import json, math, sys
c=json.load(open(sys.argv[1],encoding='utf-8')); actual=json.load(open(sys.argv[2],encoding='utf-8'))
debt=c['principal']; rates=[]; maximum=0; checked=0
for i,date in enumerate(c['dates']):
 m=i+1; annual=next(x['annual'] for x in c['cdi'] if x['year']==int(date[:4])); gross=(1+annual*c['cdbShare'])**(1/12)-1
 tbf=gross/c['cdbShare']*c['tbfFactor']; band=max((x for x in c['trBands'] if x['threshold']<=tbf),key=lambda x:x['threshold']); tr=0 if i==0 else max(0,(1+tbf)/(band['a']+band['b']*tbf)-1); rates.append(tr)
 if i and math.floor(debt+.5)<=0: debt=0
 corrected=debt*(1+tr); interest=corrected*((1+c['annualInterest'])**(1/12)-1) if debt else 0; amort=corrected/(c['term']-m+1) if debt else 0
 mip=corrected*max((x for x in c['mipBands'] if x['threshold']<=m),key=lambda x:x['threshold'])['rate'] if debt else 0
 fgts=c['biennialFgts']*(1+sum(rates[max(0,i-11):i+1])) if debt and m%24==0 else 0
 plr=c['plr'] if debt and c['strategy']=='Finan' and m%12==0 else 0
 extra=min(max(0,corrected-amort),fgts+plr) if debt else 0
 closing=max(0,corrected-amort-extra) if debt else 0
 installment=interest+amort+mip+c['dfi']+c['admin'] if debt else 0
 expected={'C':debt,'D':tr,'E':interest,'F':amort,'G':mip,'K':extra,'L':installment,'M':closing,'correction':corrected-debt,'correctedDebt':corrected}
 for key,value in expected.items():
  delta=abs(value-actual['sac'][i][key]); maximum=max(maximum,delta); checked+=1
  assert delta<=.01,(date,key,value,actual['sac'][i][key])
 debt=closing
print(json.dumps({'checked':checked,'maxDelta':maximum,'passed':True}))
