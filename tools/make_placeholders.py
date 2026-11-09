# 產生佔位圖：立繪（長立繪剪影）與背景。
#   python3 tools/make_placeholders.py            只補缺少的檔案（已存在的不覆蓋，換上正式圖後可放心重跑）
#   python3 tools/make_placeholders.py --redo-chara   重畫「所有」立繪佔位圖（會覆蓋！只在還沒有正式立繪時使用）
# 立繪：1008x1792（9:16 長立繪）透明 WebP，assets/chara/<角色id>/<表情>.webp（多套服裝：<角色id>/<服裝>/<表情>.webp），規格見 docs/sprite_spec.md
#       角色與表情清單直接讀 story/story.js，新增角色或表情後重跑即可。
# 背景：1920x1920 WebP，assets/bg/<名稱>.webp（已存在的不覆蓋，正式背景放進來後可放心重跑）
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

# ---------- 立繪：長立繪剪影（1008x1792，規格見 docs/sprite_spec.md）----------
W, H = 1008, 1792
HEAD_TOP, HEAD_R = 126, 190            # 繪製用的基準頭（半徑 190），畫好後放大成正式規格的頭高
HEAD_H = 420                           # 正式規格：頭頂 y≈126（7%），頭高約 420（23%，下巴 y≈546）
WAIST = 1344                           # 上方 3:4 段的底邊（腰）
CX = W // 2
HY = HEAD_TOP + HEAD_R                 # 頭的圓心
COLORS = {"draconia": (120, 140, 190), "ron": (200, 110, 70), "hermione": (150, 100, 70), "hagrid": (120, 90, 60),
          "molly": (190, 130, 100), "ollivander": (110, 110, 120), "malkin": (160, 110, 140), "crabbe": (90, 110, 90), "goyle": (110, 95, 80),
          "mcgonagall": (60, 110, 80), "sorting_hat": (110, 90, 60), "neville": (150, 120, 90), "fred": (200, 100, 60), "george": (190, 95, 65), "dumbledore": (140, 120, 170), "percy": (180, 105, 70), "pansy": (90, 130, 100), "snape": (40, 40, 48),
          "hooch": (150, 140, 100), "wood": (170, 80, 60),
          "flitwick": (18, 18, 22), "quirrell": (110, 70, 140),
          "unknown": (10, 10, 12), "filch": (100, 110, 90), "peeves": (150, 120, 170), "flint": (18, 18, 22), "lee": (120, 90, 60), "pince": (18, 18, 22)}   # flint、pince 黑影立繪
# 黑影立繪（佔位用近黑色）：flitwick、unknown（？？？共用）、malkin、ollivander、hooch
for _k in ("malkin", "ollivander", "hooch"): COLORS[_k] = (18, 18, 22)

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
    elif face == "disdain":
        for s in (-1, 1): d.line([CX + s * ex - 26, ey + 4, CX + s * ex + 26, ey - 4 * s], fill=ink, width=10)
        d.line([CX - 50, HY + 100, CX + 40, HY + 86], fill=ink, width=9)
    elif face == "panic":
        for s in (-1, 1): d.ellipse([CX + s * ex - 10, ey - 10, CX + s * ex + 10, ey + 10], fill=ink)
        d.line([(CX - 50, HY + 100), (CX - 25, HY + 88), (CX, HY + 100), (CX + 25, HY + 88), (CX + 50, HY + 100)], fill=ink, width=8)
    elif face == "cute":
        for s in (-1, 1): d.arc([CX + s * ex - 24, ey - 6, CX + s * ex + 24, ey + 26], 200, 340, fill=ink, width=8)
        d.ellipse([CX - 14, HY + 84, CX + 14, HY + 112], outline=ink, width=7)
    elif face == "cry":
        for s in (-1, 1):
            d.arc([CX + s * ex - 24, ey - 6, CX + s * ex + 24, ey + 26], 20, 160, fill=ink, width=8)
            d.ellipse([CX + s * ex - 10, ey + 30, CX + s * ex + 10, ey + 64], fill=(110, 170, 230, 255))
        d.arc([CX - 60, HY + 80, CX + 60, HY + 150], 200, 340, fill=ink, width=10)
    else:  # normal
        for s in (-1, 1): d.ellipse([CX + s * ex - er, ey - er, CX + s * ex + er, ey + er], fill=ink)
        d.line([CX - 40, HY + 100, CX + 40, HY + 100], fill=ink, width=9)

OUTFIT_LABEL = {"casual": "便服", "slytherin": "史萊哲林", "gryffindor": "葛來分多", "winter": "冬裝"}
WINTER_HOUSE = {"draconia": "slytherin"}   # 冬裝＝學院校服＋頸巾；沒列的角色是葛來分多
OUTFIT_COLOR = {"slytherin": (34, 70, 52), "gryffindor": (110, 34, 34)}   # 史萊哲林綠、葛來分多紅
def chara(cid, name, face, color, outfit=None):
    p = os.path.join(ROOT, "chara", cid, *( [outfit] if outfit else [] ), face + ".webp")
    if outfit in OUTFIT_COLOR: color = OUTFIT_COLOR[outfit]
    if outfit == "winter": color = OUTFIT_COLOR[WINTER_HOUSE.get(cid, "gryffindor")]
    if os.path.exists(p) and not REDO: return False
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    body = color + (255,); edge = (255, 255, 255, 235)
    chin = HEAD_TOP + HEAD_H                                      # 下巴 y≈650
    # 身體：肩膀到腰，腰以下是下半身（長立繪多出來的部分，平常藏在對話框後面）
    d.rounded_rectangle([CX - 370, chin + 92, CX + 370, WAIST + 40], 185, fill=body, outline=edge, width=7)
    leg = tuple(int(c * 0.7) for c in color) + (255,)
    d.rounded_rectangle([CX - 300, WAIST - 20, CX + 300, H + 100], 120, fill=leg, outline=edge, width=7)
    d.line([CX - 300, WAIST, CX + 300, WAIST], fill=edge, width=5)
    # 脖子
    d.rectangle([CX - 76, chin - 50, CX + 76, chin + 126], fill=body)
    if outfit == "winter":   # 頸巾：學院兩色條紋
        c2 = (200, 200, 205, 255) if WINTER_HOUSE.get(cid) == "slytherin" else (210, 170, 60, 255)
        for i in range(6): d.rectangle([CX - 160, chin + 20 + i * 24, CX + 160, chin + 44 + i * 24], fill=(body if i % 2 == 0 else c2))
    # 頭：先用基準尺寸畫好（含表情），再放大到頭高 HEAD_H 貼上
    hd = Image.new("RGBA", (W, H), (0, 0, 0, 0)); hdd = ImageDraw.Draw(hd)
    hdd.ellipse([CX - HEAD_R, HEAD_TOP, CX + HEAD_R, HEAD_TOP + 2 * HEAD_R], fill=(240, 236, 228, 255), outline=edge, width=6)
    face_marks(hdd, face, (60, 50, 50, 255))
    box = (CX - HEAD_R - 4, HEAD_TOP - 4, CX + HEAD_R + 4, HEAD_TOP + 2 * HEAD_R + 4)
    k = HEAD_H / (2 * HEAD_R)
    head = hd.crop(box).resize((round((box[2] - box[0]) * k), round((box[3] - box[1]) * k)), Image.LANCZOS)
    im.alpha_composite(head, (CX - head.width // 2, HEAD_TOP - round(4 * k)))
    # 文字
    center(d, W, 740, name + ("．" + OUTFIT_LABEL.get(outfit, outfit) if outfit else ""), font(80, True), (255, 255, 255, 255))
    center(d, W, 874, cid.upper() + (" · " + outfit if outfit else "") + " · " + face, font(44), (255, 255, 255, 235))
    center(d, W, WAIST + 30, "waist (3:4 line)", font(30), (255, 255, 255, 200))
    center(d, W, 1700, "PLACEHOLDER 1008x1792 (long)", font(30), (255, 255, 255, 200))
    im.save(p, "WEBP", lossless=True, method=6)
    return True

def load_characters():
    src = open(os.path.join(HERE, "..", "story", "story.js"), encoding="utf-8").read()
    block = src[src.index("export const characters"):]
    block = block[:block.index("};")]
    out = []
    for m in re.finditer(r'(\w+):\s*\{([^}]*)\}', block):
        body = m.group(2)
        nm = re.search(r'name:\s*"([^"]+)"', body); fc = re.search(r'faces:\s*\[([^\]]*)\]', body); oc = re.search(r'outfits:\s*\[([^\]]*)\]', body)
        if not nm or not fc: continue
        out.append((m.group(1), nm.group(1), re.findall(r'"(\w+)"', fc.group(1)), re.findall(r'"(\w+)"', oc.group(1)) if oc else []))
    return out

made = 0
for cid, name, faces, outfits in load_characters():
    for outfit in (outfits or [None]):
        for face in faces:
            made += chara(cid, name, face, COLORS.get(cid, (120, 120, 120)), outfit)

# ---------- 背景 ----------
def bg(name, label, c1, c2):
    p = os.path.join(ROOT, "bg", name)
    if os.path.exists(p): return
    S = 1920; im = Image.new("RGB", (S, S)); d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / S; d.line([(0, y), (S, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    d.rectangle([480, 480, 1440, 1440], outline=(255, 255, 255), width=6)
    center(d, S, 900, label, font(110), (255, 255, 255)); center(d, S, 1060, "safe area: keep key content in the centre square", font(44), (240, 240, 240)); im.save(p, "WEBP", quality=85, method=6)
bg("kings_cross.webp", "PLATFORM 9 3/4", (92, 76, 68), (176, 150, 120))
bg("train_compartment.webp", "TRAIN COMPARTMENT", (78, 50, 52), (170, 126, 96))
bg("hogsmeade_station.webp", "HOGSMEADE STATION", (24, 32, 62), (90, 100, 128))
bg("ollivanders.webp", "OLLIVANDERS", (52, 40, 34), (130, 104, 80))
bg("eeylops.webp", "EEYLOPS OWL EMPORIUM", (40, 36, 30), (110, 96, 70))
bg("leaky_cauldron.webp", "LEAKY CAULDRON", (46, 30, 22), (126, 86, 54))
bg("entrance_hall_day.webp", "ENTRANCE HALL (DAY)", (50, 46, 52), (128, 116, 104))
bg("staff_room.webp", "STAFF ROOM", (60, 40, 30), (150, 100, 60))
bg("pitch_passage.webp", "PITCH PASSAGE", (30, 26, 22), (110, 90, 60))
bg("entrance_hall_night.webp", "ENTRANCE HALL (NIGHT)", (16, 18, 40), (90, 70, 50))
bg("great_hall_day.webp", "GREAT HALL (DAY)", (150, 170, 200), (180, 150, 110))
bg("great_hall_night.webp", "GREAT HALL (NIGHT)", (14, 16, 44), (110, 80, 50))
bg("gryffindor_dorm.webp", "GRYFFINDOR DORM", (70, 22, 24), (150, 92, 60))
bg("library.webp", "LIBRARY", (48, 36, 26), (130, 104, 72))
bg("gryffindor_common.webp", "GRYFFINDOR COMMON ROOM", (90, 26, 24), (170, 110, 60))
bg("potions_classroom.webp", "POTIONS CLASSROOM", (18, 30, 26), (70, 90, 80))
bg("hagrid_hut.webp", "HAGRID'S HUT", (60, 44, 30), (140, 110, 76))
bg("training_grounds.webp", "TRAINING GROUNDS", (60, 96, 120), (90, 130, 70))
bg("trophy_room.webp", "TROPHY ROOM", (20, 26, 44), (90, 96, 120))
bg("quidditch_pitch.webp", "QUIDDITCH PITCH", (200, 110, 60), (70, 110, 60))
bg("quidditch_pitch_sunset.webp", "QUIDDITCH PITCH (SUNSET)", (230, 120, 60), (90, 60, 70))
bg("charms_classroom.webp", "CHARMS CLASSROOM", (60, 50, 80), (140, 120, 100))
bg("girls_bathroom.webp", "GIRLS' BATHROOM", (50, 60, 64), (120, 130, 128))
bg("slytherin_common.webp", "SLYTHERIN COMMON ROOM", (10, 30, 24), (40, 90, 70))
bg("mirror_room.webp", "MIRROR ROOM", (20, 18, 24), (110, 90, 50))
print("立繪佔位圖：產生", made, "張")
