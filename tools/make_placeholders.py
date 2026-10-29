# 產生佔位圖：立繪（半身剪影）與背景。
#   python3 tools/make_placeholders.py            只補缺少的檔案（已存在的不覆蓋，換上正式圖後可放心重跑）
#   python3 tools/make_placeholders.py --redo-chara   重畫「所有」立繪佔位圖（會覆蓋！只在還沒有正式立繪時使用）
# 立繪：1200x1600 透明 PNG，assets/chara/<角色id>/<表情>.png，規格見 docs/sprite_spec.md
#       角色與表情清單直接讀 story/story.js，新增角色或表情後重跑即可。
# 背景：1920x1920 JPG，assets/bg/<名稱>.jpg
from PIL import Image, ImageDraw, ImageFont
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "assets")
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CJK = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
REDO = "--redo-chara" in sys.argv

def font(n, cjk=False):
    try: return ImageFont.truetype(CJK, n, index=3) if cjk else ImageFont.truetype(FB, n)
    except Exception: return ImageFont.load_default()
def center(d, w, y, text, f, fill):
    b = d.textbbox((0, 0), text, font=f); d.text(((w - (b[2] - b[0])) / 2 - b[0], y), text, font=f, fill=fill)

# ---------- 立繪：半身剪影 ----------
W, H = 1200, 1600
HEAD_TOP, HEAD_R = 150, 190            # 頭頂距畫布上緣 150（約 9%），頭半徑 190
CX = W // 2
HY = HEAD_TOP + HEAD_R                 # 頭的圓心
COLORS = {"draconia": (120, 140, 190), "ron": (200, 110, 70), "hermione": (150, 100, 70), "hagrid": (120, 90, 60),
          "molly": (190, 130, 100), "ollivander": (110, 110, 120), "malkin": (160, 110, 140), "crabbe": (90, 110, 90), "goyle": (110, 95, 80)}

def face_marks(d, face, ink):
    # 用簡單的眉、眼、嘴區分表情（佔位用，方便測試換表情）
    ey, ex, er = HY - 10, 70, 16
    if face == "happy":
        for s in (-1, 1): d.arc([CX + s * ex - 26, ey - 10, CX + s * ex + 26, ey + 30], 200, 340, fill=ink, width=9)
        d.arc([CX - 70, HY + 20, CX + 70, HY + 110], 20, 160, fill=ink, width=10)
    elif face == "sad":
        for s in (-1, 1):
            d.ellipse([CX + s * ex - er, ey - er, CX + s * ex + er, ey + er], fill=ink)
            d.line([CX + s * ex - 30, ey - 34 - s * -12, CX + s * ex + 30, ey - 34 + s * -12], fill=ink, width=8)
        d.arc([CX - 60, HY + 80, CX + 60, HY + 150], 200, 340, fill=ink, width=10)
    elif face == "angry":
        for s in (-1, 1):
            d.ellipse([CX + s * ex - er, ey - er, CX + s * ex + er, ey + er], fill=ink)
            d.line([CX + s * ex - 32, ey - 30 + s * 14, CX + s * ex + 32, ey - 30 - s * 14], fill=ink, width=10)
        d.line([CX - 50, HY + 100, CX + 50, HY + 100], fill=ink, width=10)
    elif face == "shy":
        for s in (-1, 1):
            d.arc([CX + s * ex - 24, ey - 6, CX + s * ex + 24, ey + 26], 200, 340, fill=ink, width=8)
            d.ellipse([CX + s * 115 - 38, HY + 40, CX + s * 115 + 38, HY + 76], fill=(235, 120, 130, 200))
        d.arc([CX - 34, HY + 70, CX + 34, HY + 110], 20, 160, fill=ink, width=8)
    elif face == "surprised":
        for s in (-1, 1): d.ellipse([CX + s * ex - 22, ey - 24, CX + s * ex + 22, ey + 24], outline=ink, width=8)
        d.ellipse([CX - 26, HY + 70, CX + 26, HY + 130], outline=ink, width=9)
    elif face == "smug":
        for s in (-1, 1): d.line([CX + s * ex - 26, ey, CX + s * ex + 26, ey], fill=ink, width=10)
        d.arc([CX - 70, HY + 40, CX + 40, HY + 110], 10, 120, fill=ink, width=10)
    else:  # normal
        for s in (-1, 1): d.ellipse([CX + s * ex - er, ey - er, CX + s * ex + er, ey + er], fill=ink)
        d.line([CX - 40, HY + 100, CX + 40, HY + 100], fill=ink, width=9)

def chara(cid, name, face, color):
    p = os.path.join(ROOT, "chara", cid, face + ".png")
    if os.path.exists(p) and not REDO: return False
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    body = color + (255,); edge = (255, 255, 255, 235)
    # 身體：肩膀到畫布底部（腰部平切）
    d.rounded_rectangle([CX - 420, HY + HEAD_R + 120, CX + 420, H + 120], 220, fill=body, outline=edge, width=8)
    # 脖子
    d.rectangle([CX - 80, HY + HEAD_R - 40, CX + 80, HY + HEAD_R + 150], fill=body)
    # 頭
    d.ellipse([CX - HEAD_R, HEAD_TOP, CX + HEAD_R, HEAD_TOP + 2 * HEAD_R], fill=(240, 236, 228, 255), outline=edge, width=8)
    face_marks(d, face, (60, 50, 50, 255))
    # 文字
    center(d, W, 820, name, font(120, True), (255, 255, 255, 255))
    center(d, W, 980, cid.upper() + " · " + face, font(64), (255, 255, 255, 235))
    center(d, W, 1490, "PLACEHOLDER 1200x1600 (half body)", font(30), (255, 255, 255, 200))
    im.save(p, optimize=True)
    return True

def load_characters():
    src = open(os.path.join(HERE, "..", "story", "story.js"), encoding="utf-8").read()
    block = src[src.index("export const characters"):]
    block = block[:block.index("};")]
    out = []
    for m in re.finditer(r'(\w+):\s*\{\s*name:\s*"([^"]+)",\s*faces:\s*\[([^\]]*)\]', block):
        out.append((m.group(1), m.group(2), re.findall(r'"(\w+)"', m.group(3))))
    return out

made = 0
for cid, name, faces in load_characters():
    for face in faces:
        made += chara(cid, name, face, COLORS.get(cid, (120, 120, 120)))

# ---------- 背景 ----------
def bg(name, label, c1, c2):
    p = os.path.join(ROOT, "bg", name)
    if os.path.exists(p): return
    S = 1920; im = Image.new("RGB", (S, S)); d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / S; d.line([(0, y), (S, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    d.rectangle([480, 480, 1440, 1440], outline=(255, 255, 255), width=6)
    center(d, S, 900, label, font(110), (255, 255, 255)); center(d, S, 1060, "safe area: keep key content in the centre square", font(44), (240, 240, 240)); im.save(p, quality=88)
bg("kings_cross.jpg", "PLATFORM 9 3/4", (92, 76, 68), (176, 150, 120))
bg("train_compartment.jpg", "TRAIN COMPARTMENT", (78, 50, 52), (170, 126, 96))
bg("hogsmeade_station.jpg", "HOGSMEADE STATION", (24, 32, 62), (90, 100, 128))
bg("ollivanders.jpg", "OLLIVANDERS", (52, 40, 34), (130, 104, 80))
bg("eeylops.jpg", "EEYLOPS OWL EMPORIUM", (40, 36, 30), (110, 96, 70))
bg("leaky_cauldron.jpg", "LEAKY CAULDRON", (46, 30, 22), (126, 86, 54))
print("立繪佔位圖：產生", made, "張")
