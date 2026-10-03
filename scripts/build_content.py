from pathlib import Path
import json,re,html,sys,shutil,urllib.parse
root=Path(__file__).parent
site=Path(sys.argv[1]) if len(sys.argv)>1 else root/'site'
content=Path(sys.argv[2]) if len(sys.argv)>2 else root/'content'
index=site/'index.html'
s=index.read_text()
m=re.search(r'const DATA=(.*?);const LIBS=',s,re.S)
if not m:raise SystemExit('Site dataset absent')
data=json.loads(m.group(1));overrides={};newtools=[];articles=[]
for p in sorted(content.glob('*.json')):
 obj=json.loads(p.read_text())
 if obj.get('schema')!=1 or obj.get('kind') not in ('article','tool','description'):raise SystemExit('Invalid content schema '+p.name)
 kind=obj['kind'];title=obj.get('title','').strip();body=obj.get('body','').strip()
 if not title or not body or len(title)>200 or len(body)>25000:raise SystemExit('Invalid title or body '+p.name)
 if kind=='description':
  url=obj.get('target_url','').strip();
  if not url.startswith(('https://','http://')):raise SystemExit('Description URL required '+p.name)
  if url in overrides:raise SystemExit('Duplicate description target '+p.name)
  overrides[url]=body
 elif kind=='tool':
  url=obj.get('url','').strip();
  if not url.startswith(('https://','http://')):raise SystemExit('Tool URL required '+p.name)
  if any(u==url for _,u,_ in newtools):raise SystemExit('Duplicate new tool '+p.name)
  newtools.append((title,url,body))
 else:articles.append((title,body,p.stem))
updated=0
def walk(n):
 global updated
 if n.get('url') in overrides:
  n['arDescription']=overrides[n['url']];updated+=1
 for ch in n.get('children',[]):walk(ch)
walk(data)
if len(overrides)!=updated:raise SystemExit('Some target URLs were not found in existing directory')
if newtools:
 data['children'].append({'name':'Community additions','ar':'إضافات الدليل','type':'folder','children':[{'name':name,'type':'url','url':url,'arDescription':desc} for name,url,desc in newtools]})
if overrides or newtools:
 encoded=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
 s=s[:m.start(1)]+encoded+s[m.end(1):]
 index.write_text(s)
# Generate news/articles and content overview, entirely escaped. Pagefind indexes the new pages.
style='<style>@font-face{font-family:Cairo;src:url(../Cairo.ttf) format("truetype");font-weight:100 900;font-display:swap}body{margin:0;background:#f6f9f7;color:#142b31;font:700 17px/1.9 Cairo,Tahoma,Arial,sans-serif}.page{max-width:940px;margin:auto;padding:25px 17px}header{background:#102735;color:#fff;border-radius:16px;padding:24px}header a{color:#d9f4e9}article{background:white;border:1px solid #dbe7e5;border-radius:14px;margin:20px 0;padding:25px}a{color:#08716d}p{white-space:pre-wrap}</style>'
# The articles section was removed at the owner's request (still in git history).
# Catalog static pages are regenerated to make edited descriptions searchable.
for p in (site/'catalog').glob('category-*.html'):p.unlink()
css='''<style>@font-face{font-family:Cairo;src:url(../Cairo.ttf) format("truetype");font-weight:100 900;font-display:swap}body{font:700 16px/1.8 Cairo,Tahoma,sans-serif;background:#f6f9f7;color:#142b31;margin:0}.page{max-width:940px;margin:auto;padding:28px 18px}header{background:#102735;color:white;padding:20px;border-radius:15px;margin-bottom:22px}a{color:#08716d}.card{background:white;border:1px solid #dbe7e5;border-radius:12px;padding:17px;margin:12px 0}.card h2{margin:0 0 5px;font-size:21px}.card small{color:#52646d}.card p{margin:5px 0}.back{color:white}</style>'''
for i,top in enumerate(data['children']):
 group=[]
 def entries(n,path=[]):
  if n.get('url'):group.append((n,path))
  for ch in n.get('children',[]):entries(ch,path+[n.get('ar') or n['name']])
 entries(top)
 title=top.get('ar') or top['name'];parts=['<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title>'+css+'<div class="page"><header><a class="back" href="../index.html">العودة إلى الدليل</a><h1>'+html.escape(title)+'</h1></header><main data-pagefind-body>']
 for j,(n,path) in enumerate(group):
  parts.append('<article class="card"><h2 data-pagefind-sub-result id="tool-'+str(j)+'">'+html.escape(n['name'])+'</h2><small>'+html.escape(' / '.join(path[1:]))+'</small><p>'+html.escape(n.get('arDescription','راجع المصدر الأولي.'))+'</p><a href="../index.html#tree">تفاصيل الأداة في الدليل</a></article>')
 parts.append('</main></div></html>');(site/'catalog'/f'category-{i+1:02}.html').write_text(''.join(parts))
# Search data for the beta tool is regenerated with content edits.
arr=[]
def collect(n):
 if n.get('url') and not n.get('unverifiedLink') and n.get('arDescription'):arr.append({'name':n['name'],'description':n['arDescription'][:300],'url':n['url']})
 for ch in n.get('children',[]):collect(ch)
collect(data)
(site/'search-tools.json').write_text(json.dumps(arr,ensure_ascii=False,separators=(',',':')))
print('articles',len(articles),'new tools',len(newtools),'edited descriptions',updated,'search tools',len(arr))

# Apply analytics to every deployed HTML page, including new articles and regenerated catalog.
for page in site.rglob('*.html'):
 if page.name == 'admin.html': continue  # encrypted gate is intentionally untracked
 text=page.read_text()
 script=('<script defer src="'+('../'*(len(page.relative_to(site).parts)-1))+'analytics.js"></script>')
 if 'analytics.js' not in text:
  text=text.replace('</body>',script+'</body>') if '</body>' in text else text.replace('</html>',script+'</html>')
  page.write_text(text)
