# 用正式立繪裁出對話紀錄的圓形頭像（256x256），覆蓋 assets/avatar/<角色id>.png
#   python3 tools/avatar_from_sprite.py draconia draconia/noble/normal.webp 508 318 400
#   參數：角色id、立繪路徑（assets/chara/ 之下）、臉部中心 x、y、裁切邊長（原圖像素）
# 同一個角色的參數換表情、換服裝都通用（同尺寸）。長立繪 1008x1792 的頭頂約 y≈126、下巴約 y≈546（舊 1200x1600 的 0.84 倍）。
from PIL import Image, ImageDraw
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "assets")
S = 256

def make(cid, sprite, cx, cy, size, bg1=(28, 58, 46), bg2=(10, 26, 20)):
    im = Image.open(os.path.join(ROOT, "chara", sprite)).convert("RGBA")
    h = size // 2
    face = im.crop((cx - h, cy - h, cx + h, cy + h)).resize((S * 2, S * 2), Image.LANCZOS)
    out = Image.new("RGBA", (S * 2, S * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(out)
    for y in range(S * 2):                                    # 底色：深綠漸層（頭髮邊緣的透明處會透出來）
        t = y / (S * 2); d.line([(0, y), (S * 2, y)], fill=tuple(int(bg1[i] * (1 - t) + bg2[i] * t) for i in range(3)) + (255,))
    out.alpha_composite(face)
    mask = Image.new("L", (S * 2, S * 2), 0); ImageDraw.Draw(mask).ellipse([4, 4, S * 2 - 5, S * 2 - 5], fill=255)
    out.putalpha(mask)
    ImageDraw.Draw(out).ellipse([4, 4, S * 2 - 5, S * 2 - 5], outline=(201, 162, 74, 255), width=10)   # 金邊
    out.resize((S, S), Image.LANCZOS).save(os.path.join(ROOT, "avatar", cid + ".png"))
    print("ok", cid)

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) != 5: print(__doc__ or "用法見檔案開頭"); raise SystemExit(1)
    make(a[0], a[1], int(a[2]), int(a[3]), int(a[4]))
