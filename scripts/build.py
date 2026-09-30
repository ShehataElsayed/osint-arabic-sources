"""Build the current static site from reviewable source files, never from ZIP."""
from pathlib import Path
import json, shutil, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'_site'
def build():
    if DEST.exists(): shutil.rmtree(DEST)
    shutil.copytree(ROOT/'site',DEST)
    template=(DEST/'index.html').read_text()
    for key in ('DATA','LIBS','AITOOLS'):
        data=json.loads((ROOT/'data'/f'{key.lower()}.json').read_text())
        encoded=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
        template=template.replace(f'__{key}_JSON__',encoded)
    (DEST/'index.html').write_text(template)
    (DEST/'catalog').mkdir(exist_ok=True)
    for notice in ('LICENSE','THIRD_PARTY_NOTICES.md'):
        shutil.copy2(ROOT/notice,DEST/notice)
    subprocess.run([sys.executable,str(ROOT/'scripts/build_content.py'),str(DEST),str(ROOT/'content')],check=True)
    return DEST
if __name__=='__main__':print(build())
