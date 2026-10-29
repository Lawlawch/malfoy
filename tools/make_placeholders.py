# 產生新角色立繪與背景的佔位圖。已存在的檔案不會覆蓋（所以換上正式圖後可放心重跑）。
# 立繪 800x1200 透明 PNG：assets/chara/<角色id>/<表情>.png；背景 1920x1920 JPG：assets/bg/
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def font(n):
    try: return ImageFont.truetype(FB, n)
    except Exception: return ImageFont.load_default()
def center(d, w, y, text, f, fill):
    b = d.textbbox((0, 0), text, font=f); d.text(((w - (b[2] - b[0])) / 2 - b[0], y), text, font=f, fill=fill)
def chara(cid, face, color):
    p = os.path.join(ROOT, "chara", cid, face + ".png")
    if os.path.exists(p): return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im = Image.new("RGBA", (800, 1200), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, 790, 1190], 60, fill=color + (255,), outline=(255, 255, 255, 255), width=8)
    d.ellipse([260, 120, 540, 400], fill=(240, 240, 240, 255))
    center(d, 800, 620, cid.upper(), font(96), (255, 255, 255, 255)); center(d, 800, 760, face, font(70), (255, 255, 255, 255))
    center(d, 800, 1080, "PLACEHOLDER 800x1200", font(36), (255, 255, 255, 255)); im.save(p)
def bg(name, label, c1, c2):
    p = os.path.join(ROOT, "bg", name)
    if os.path.exists(p): return
    S = 1920; im = Image.new("RGB", (S, S)); d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / S; d.line([(0, y), (S, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    d.rectangle([480, 480, 1440, 1440], outline=(255, 255, 255), width=6)
    center(d, S, 900, label, font(110), (255, 255, 255)); center(d, S, 1060, "safe area: keep key content in the centre square", font(44), (240, 240, 240)); im.save(p, quality=88)
for face in ("normal", "happy", "angry", "surprised"): chara("ron", face, (200, 110, 70))
chara("molly", "normal", (190, 130, 100))
for face in ("smug", "surprised"): chara("draconia", face, (120, 140, 190))
chara("hermione", "normal", (150, 100, 70))
chara("ollivander", "normal", (110, 110, 120))
chara("crabbe", "normal", (90, 110, 90))
chara("goyle", "normal", (110, 95, 80))
bg("kings_cross.jpg", "PLATFORM 9 3/4", (92, 76, 68), (176, 150, 120))
bg("train_compartment.jpg", "TRAIN COMPARTMENT", (78, 50, 52), (170, 126, 96))
bg("hogsmeade_station.jpg", "HOGSMEADE STATION", (24, 32, 62), (90, 100, 128))
bg("ollivanders.jpg", "OLLIVANDERS", (52, 40, 34), (130, 104, 80))
bg("eeylops.jpg", "EEYLOPS OWL EMPORIUM", (40, 36, 30), (110, 96, 70))
bg("leaky_cauldron.jpg", "LEAKY CAULDRON", (46, 30, 22), (126, 86, 54))
print("ok")
