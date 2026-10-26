import sys, json
from . import REGISTRY, run
def main(a=None):
    a = a or sys.argv[1:]
    if not a or a[0] in ("-h", "--help", "list"):
        for t in REGISTRY.values(): print(f"{t['id']:10} {t['name_ar']} - {t['desc_ar']}")
        return 0
    t = REGISTRY.get(a[0])
    if not t: print("أداة غير معروفة"); return 2
    kw = dict(x.split("=", 1) for x in a[1:] if "=" in x)
    if not kw and not sys.stdin.isatty() and len(t["inputs"]) == 1: kw = {t["inputs"][0][0]: sys.stdin.read()}
    print(json.dumps(run(a[0], **kw), ensure_ascii=False, indent=2)); return 0
if __name__ == "__main__": sys.exit(main())
