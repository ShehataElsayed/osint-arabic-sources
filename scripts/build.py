"""Build the current static site from reviewable source files, never from ZIP."""
from pathlib import Path
import json, shutil, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'_site'
def build():
    if DEST.exists(): shutil.rmtree(DEST)
    shutil.copytree(ROOT/'site',DEST)
    shutil.copy2(ROOT/'site/site/Cairo.ttf',DEST/'Cairo.ttf')
    p=DEST/'journalist-tools.css'
    if p.exists(): p.write_text(p.read_text().replace("url('./site/Cairo.ttf')","url('./Cairo.ttf')"))
    shutil.rmtree(DEST/'site',ignore_errors=True)
    shutil.rmtree(DEST/'ite',ignore_errors=True)
    template=(DEST/'map.html').read_text()
    for key in ('DATA','LIBS','AITOOLS'):
        data=json.loads((ROOT/'2-data.json' if key=='DATA' else ROOT/'data'/f'{key.lower()}.json').read_text())
        encoded=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
        template=template.replace(f'__{key}_JSON__',encoded)
    (DEST/'map.html').write_text(template)
    (DEST/'catalog').mkdir(exist_ok=True)
    for notice in ('LICENSE','THIRD_PARTY_NOTICES.md'):
        shutil.copy2(ROOT/notice,DEST/notice)
    subprocess.run([sys.executable,str(ROOT/'scripts/build_content.py'),str(DEST),str(ROOT/'content')],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/build_branches.py'),str(DEST)],check=True)
    # Apply the shared editorial language last, across generated and source pages.
    import os, re
    for page in DEST.rglob('*.html'):
        if page in (DEST/'index.html',DEST/'journalist-tools.html'):
            continue
        text=page.read_text()
        relative=os.path.relpath(DEST/'editorial.css',page.parent).replace(os.sep,'/')
        link='<link rel="stylesheet" href="'+relative+'">'
        if 'editorial.css' in text:
            continue
        if '</head>' in text:
            text=text.replace('</head>',link+'</head>',1)
        elif '</body>' in text:
            text=text.replace('</body>',link+'</body>',1)
        else:
            text=text+link
        page.write_text(text)
    bust_cache(DEST)
    return DEST

def bust_cache(dest):
    """Append a content-hash ?v= to local .js/.css references in built HTML.

    GitHub Pages serves assets with max-age=600; without fingerprinting a deploy can leave
    visitors running a stale script against a new worker for up to ten minutes (observed
    2026-10-29: post-deploy verification ran the previous smart-search.js). Query-hash keeps
    the plain copytree pipeline unchanged and is a no-op for external/absolute/asset-less refs.
    """
    import hashlib, re
    ref = re.compile(r'((?:src|href)=")(\.?\.?/[^"?#]+\.(?:js|css))(")')
    for page in dest.rglob('*.html'):
        text = page.read_text()
        def rep(m):
            target = (page.parent / m.group(2)).resolve()
            try:
                target.relative_to(dest.resolve())
            except ValueError:
                return m.group(0)
            if not target.is_file():
                return m.group(0)
            h = hashlib.sha256(target.read_bytes()).hexdigest()[:8]
            return m.group(1) + m.group(2) + '?v=' + h + m.group(3)
        page.write_text(ref.sub(rep, text))

if __name__=='__main__':print(build())
