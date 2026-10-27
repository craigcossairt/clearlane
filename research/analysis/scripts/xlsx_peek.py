import zipfile, sys, re
import xml.etree.ElementTree as ET
p = sys.argv[1]
z = zipfile.ZipFile(p)
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
wb = ET.fromstring(z.read('xl/workbook.xml'))
sheets = [s.get('name') for s in wb.find('m:sheets', ns)]
print('sheets:', sheets)
rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
# shared strings (only first N needed, but read all strings lazily)
ss = []
with z.open('xl/sharedStrings.xml') as f:
    for ev, el in ET.iterparse(f):
        if el.tag.endswith('}si'):
            ss.append(''.join(t.text or '' for t in el.iter() if t.tag.endswith('}t')))
            el.clear()
print('shared strings', len(ss))
# map sheet name -> target
rid = {r.get('Id'): r.get('Target') for r in rels}
for s in wb.find('m:sheets', ns):
    name = s.get('name')
    if name not in sys.argv[2:]: continue
    target = rid[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
    path = 'xl/' + target.lstrip('/').replace('xl/', '')
    print('== sheet', name, path)
    rows_out = 0; last = None
    with z.open(path) as f:
        for ev, el in ET.iterparse(f):
            if el.tag.endswith('}row'):
                vals = []
                for c in el:
                    v = c.find('m:v', ns)
                    val = v.text if v is not None else ''
                    if c.get('t') == 's' and val: val = ss[int(val)]
                    vals.append(val)
                if rows_out < 3: print(vals)
                rows_out += 1; last = vals
                el.clear()
    print('rows', rows_out); print('last row', last)
