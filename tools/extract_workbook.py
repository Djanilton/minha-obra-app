"""Read-only extraction. The resulting file contains private workbook data."""
import sys,json,openpyxl
if len(sys.argv)!=3: raise SystemExit('Usage: python tools/extract_workbook.py input.xlsx private-output.json')
f=openpyxl.load_workbook(sys.argv[1],data_only=False)
v=openpyxl.load_workbook(sys.argv[1],data_only=True)
out={s.title:{c.coordinate:{'formula':(c.value if isinstance(c.value,str) else c.value.text) if c.data_type=='f' else None,'value':v[s.title][c.coordinate].value} for row in s for c in row if c.value is not None} for s in f}
with open(sys.argv[2],'w',encoding='utf-8') as target:json.dump(out,target,ensure_ascii=False,default=str)
