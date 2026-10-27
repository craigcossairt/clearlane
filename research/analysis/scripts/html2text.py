import sys, re, html

for f in sys.argv[1:]:
    t = open(f, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'<script.*?</script>', '', t, flags=re.S)
    t = re.sub(r'<style.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '\n', t)
    t = html.unescape(t)
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    lines = [l for l in lines if not l.startswith('{') and len(l) < 600]
    out = '\n'.join(lines[:160])
    sys.stdout.buffer.write(('===== ' + f.split('/')[-1] + '\n' + out + '\n').encode('utf-8', 'ignore'))
