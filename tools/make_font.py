# 重新產生字體分片：python3 tools/make_font.py
# 來源：Noto Serif CJK TC（Regular / Bold）。把整套字型（約 4.4 萬字）切成約 60 個小檔（slice），
# 並產生 assets/font/fonts.css（每片一個 @font-face + unicode-range）。
# 瀏覽器只會下載畫面上實際用到的字所在的分片，所以新增任何繁體字都不需要再重跑這支。
# 另外產生 font/vn_preload.js：劇本與介面實際用字，開機時先預載這些分片。引擎在每章開始前也會先下載該章用到的字（player.js loadFonts），劇本更新後不重跑也不會閃字；字體未到時暫時留白（font-display: block），不會先用系統字體再換回來。
import glob, os, shutil
from fontTools.ttLib import TTCollection
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
SRC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-%s.ttc"
OUT = os.path.join(ROOT, "font")
SL = os.path.join(OUT, "slices")

def ranges(cps):
    cps = sorted(cps); out = []; s = p = cps[0]
    for c in cps[1:]:
        if c == p + 1: p = c; continue
        out.append((s, p)); s = p = c
    out.append((s, p))
    return ", ".join(("U+%X" % a) if a == b else ("U+%X-%X" % (a, b)) for a, b in out)

def big5(lo_hi_rows):
    res = []
    for hi in lo_hi_rows:
        for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            try:
                ch = bytes([hi, lo]).decode("big5")
            except Exception:
                continue
            if len(ch) == 1 and ord(ch) >= 0x3400: res.append(ord(ch))
    return res

def script_text():
    t = set()
    top = os.path.join(ROOT, "..")
    for pat in ("story/*.txt", "story/*.js", "engine/*.js", "engine/style/*.css"):
        for p in glob.glob(os.path.join(top, pat)):
            t |= set(open(p, encoding="utf-8").read())
    return set(c for c in t if ord(c) > 0x7F and c not in "\r\n\t")
reg = TTCollection(SRC % "Regular").fonts[3]
cmap = reg.getBestCmap()
allcp = set(cmap.keys()) - {0}

def isideo(c): return 0x3400 <= c <= 0x4DBF or 0x4E00 <= c <= 0x9FFF or 0xF900 <= c <= 0xFAFF or 0x20000 <= c <= 0x2FFFF
common = [c for c in dict.fromkeys(big5(range(0xA4, 0xC7))) if c in allcp]          # Big5 常用字
rare = [c for c in dict.fromkeys(big5(range(0xC9, 0xFA))) if c in allcp and c not in set(common)]   # Big5 次常用字
text = script_text()
hot = sorted(c for c in (ord(x) for x in text) if c in allcp and isideo(c))                 # 劇本實際用到的漢字：自成分片，開機只載這些
common = [c for c in common if c not in set(hot)]; rare = [c for c in rare if c not in set(hot)]
used = set(common) | set(rare) | set(hot)
rest = sorted(c for c in allcp if isideo(c) and c not in used)
nonid = sorted(c for c in allcp if not isideo(c))
base = [c for c in nonid if c < 0x3400 or 0xFE00 <= c <= 0xFFEF]            # 拉丁、標點、符號、假名、注音、全形字
other = [c for c in nonid if c not in set(base)]                           # 韓文等，幾乎用不到

slices = [("base", base)]
def chunk(name, lst, n):
    for i in range(0, len(lst), n):
        slices.append(("%s%02d" % (name, i // n), lst[i:i + n]))
chunk("s", hot, 700); chunk("x", other, 1500); chunk("a", common, 300); chunk("b", rare, 400); chunk("c", rest, 900)
print("slices:", len(slices), "base", len(base), "other", len(other), "common", len(common), "rare", len(rare), "rest", len(rest))

# 劇本與介面用字（供預載與缺字檢查）
missing = sorted(c for c in text if ord(c) not in cmap and not c.isspace())
print("劇本/介面用字 %d 個；字體缺字 %d 個：%s" % (len(text), len(missing), "".join(missing) or "（無）"))

if os.path.isdir(SL): shutil.rmtree(SL)
os.makedirs(SL)
css = ["/* 由 tools/make_font.py 產生，請勿手改 */"]
for tag, w, wt in (("R", "Regular", 400), ("B", "Bold", 700)):
    for name, cps in slices:
        f = TTCollection(SRC % w).fonts[3]
        o = subset.Options(); o.flavor = "woff2"; o.layout_features = ["kern", "vert", "vrt2", "locl"]
        o.hinting = False; o.notdef_outline = (name == "base"); o.name_IDs = ["*"] if name == "base" else []
        s = subset.Subsetter(o); s.populate(unicodes=cps); s.subset(f)
        fn = "%s-%s.woff2" % (tag, name); f.flavor = "woff2"; f.save(os.path.join(SL, fn))
        css.append("@font-face { font-family: 'VN Serif'; font-style: normal; font-weight: %d; font-display: block; src: url('./slices/%s') format('woff2'); unicode-range: %s; }" % (wt, fn, ranges(cps)))
    print(w, "done")
import re as _re
_c = "\n".join(css)
_c = _re.sub(r"\s*([{};:,])\s*", r"\1", _c)
open(os.path.join(OUT, "fonts.css"), "w").write(_c + "\n")  # 壓縮輸出
pre = "".join(sorted(text, key=ord))
open(os.path.join(OUT, "vn_preload.js"), "w", encoding="utf-8").write("window.VN_PRELOAD = %s;\n" % ('"' + pre.replace("\\", "\\\\").replace('"', '\\"') + '"'))
tot = sum(os.path.getsize(os.path.join(SL, x)) for x in os.listdir(SL))
print("slices total %.1f MB, %d files" % (tot / 1048576, len(os.listdir(SL))))
