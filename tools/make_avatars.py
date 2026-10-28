# 產生頭像佔位圖（256x256 圓形）。正式頭像請用同檔名覆蓋：assets/avatar/<角色id>.png
from PIL import Image, ImageDraw, ImageFont
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "avatar")
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
S = 256
def base(c1, c2):
    im = Image.new("RGBA", (S*2, S*2), (0,0,0,0)); d = ImageDraw.Draw(im)
    for y in range(S*2):
        t = y/(S*2); col = tuple(int(c1[i]*(1-t)+c2[i]*t) for i in range(3))+(255,)
        d.line([(0,y),(S*2,y)], fill=col)
    mask = Image.new("L", (S*2, S*2), 0); ImageDraw.Draw(mask).ellipse([4,4,S*2-5,S*2-5], fill=255)
    im.putalpha(mask); return im
def ring(im):
    d = ImageDraw.Draw(im); d.ellipse([4,4,S*2-5,S*2-5], outline=(201,162,74,255), width=10)
def save(im, name): im.resize((S,S), Image.LANCZOS).save(os.path.join(OUT, name+".png"))
for name, ch, c1, c2 in (("draconia","D",(188,196,214),(96,106,138)), ("hagrid","海",(150,110,70),(80,52,30)), ("malkin","摩",(168,120,150),(96,60,90)), ("ron","榮",(214,128,84),(128,56,36)), ("molly","衛",(206,150,110),(130,84,60))):
    if os.path.exists(os.path.join(OUT, name + ".png")): continue      # 已有的頭像（含你換上的正式圖）不覆蓋
    im = base(c1, c2); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 300, index=3); b = d.textbbox((0,0), ch, font=f)
    d.text(((S*2-(b[2]-b[0]))/2-b[0], (S*2-(b[3]-b[1]))/2-b[1]), ch, font=f, fill=(255,255,255,235)); ring(im); save(im, name)
# 哈利：陰影剪影（第一人稱，無立繪）
if os.path.exists(os.path.join(OUT, "harry.png")): print("ok"); raise SystemExit
im = base((70,62,78),(24,20,30)); d = ImageDraw.Draw(im); sil=(12,10,16,255)
d.ellipse([S-110, 150, S+110, 370], fill=sil)                 # 頭
d.pieslice([S-230, 330, S+230, 800], 180, 360, fill=sil)       # 肩
d.rectangle([S-60, 340, S+60, 420], fill=sil)                  # 頸
ring(im); save(im, "harry")
print("ok")
