# 產生對話框句末的羽毛筆 assets/ui/quill.png（160×160，顯示時約 52px）。執行：python3 tools/make_quill.py
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
random.seed(4)
S=1280; img=Image.new("RGBA",(S,S),(0,0,0,0))
A=(110,1210); B=(1120,120)               # 筆尖 → 羽毛末端
ax,ay=B[0]-A[0],B[1]-A[1]; L=math.hypot(ax,ay); ux,uy=ax/L,ay/L; nx,ny=-uy,ux  # 軸向、法向
bend=120
def P(t):   # 中軸（羽軸微彎）
    k=bend*math.sin(math.pi*t)*min(1,t/0.3)**2
    return (A[0]+ax*t+nx*k, A[1]+ay*t+ny*k)
def D(t):
    a=P(max(0,t-0.002)); b=P(min(1,t+0.002)); l=math.hypot(b[0]-a[0],b[1]-a[1]); return ((b[0]-a[0])/l,(b[1]-a[1])/l)
T0=0.30  # 羽片起點
def width(t, side):
    s=(t-T0)/(1-T0)
    if s<0: return 0
    base=math.sin(math.pi*min(1,s*1.05))**0.75*(1-0.25*s)
    return (330 if side>0 else 200)*base
# --- 羽片：一根根羽枝 ---
lay=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(lay)
for side in (1,-1):
    N=900; skip=0; splitoff=0
    for i in range(N):
        t=T0+(1-T0)*i/N
        if random.random()<0.012: skip=random.randint(2,6); splitoff=random.uniform(-0.12,0.12)
        w=width(t,side)*random.uniform(0.9,1.04)
        if w<4: continue
        dx,dy=D(t); px,py=P(t)
        ang=math.radians(48 if side>0 else 52)
        # 羽枝方向：從羽軸向外、往末端斜
        nxx,nyy=(-dy*side,dx*side)
        ca,sa=math.cos(ang),math.sin(ang)
        bx,by=nxx*ca+dx*sa, nyy*ca+dy*sa
        off=splitoff if skip>0 else 0; skip=max(0,skip-1)
        curve=0.18+off
        pts=[]
        for j in range(9):
            q=j/8; c=curve*q*q
            vx,vy=bx+dx*c, by+dy*c; vl=math.hypot(vx,vy)
            pts.append((px+vx/vl*w*q, py+vy/vl*w*q))
        shade=random.uniform(0.84,1.0)*(0.70 if side<0 else 1.0)
        tip_fade=1-0.35*((t-T0)/(1-T0))**3
        col=(int(240*shade),int(234*shade),int(220*shade),int(215*tip_fade))
        d.line(pts[:3],fill=(int(170*shade),int(160*shade),int(142*shade),col[3]),width=3)
        d.line(pts[2:],fill=col,width=3)
        # 羽枝末端稍暗，做出邊緣層次
        d.line(pts[6:],fill=(int(200*shade),int(192*shade),int(176*shade),int(150*tip_fade)),width=2)
# 羽片根部的絨毛
for i in range(260):
    t=random.uniform(0.27,0.40); px,py=P(t); side=random.choice((1,-1)); dx,dy=D(t)
    a=random.uniform(0.3,1.3)*side; L2=random.uniform(30,120)
    pts=[(px,py)]; x,y=px,py; vx,vy=(-dy*math.cos(a)+dx*math.sin(abs(a)))*side*(1 if side>0 else -1), 0
    vx,vy=-dy*side, dx*side
    for j in range(6):
        r=random.uniform(-0.5,0.5); vx,vy=vx*math.cos(r)-vy*math.sin(r), vx*math.sin(r)+vy*math.cos(r)
        x+=vx*L2/6+dx*L2/10; y+=vy*L2/6+dy*L2/10; pts.append((x,y))
    d.line(pts,fill=(245,240,228,random.randint(60,130)),width=2)
lay=lay.filter(ImageFilter.GaussianBlur(0.6))
img.alpha_composite(lay)
# --- 羽軸 ---
d=ImageDraw.Draw(img)
for k,(col,wmul) in enumerate([((150,138,118,255),1.0),((236,228,210,255),0.55),((255,252,244,230),0.22)]):
    pts=[P(0.17+0.83*i/200) for i in range(201)]
    for i in range(200):
        t=i/200; w=max(1,(16*(1-t)+3)*wmul)
        d.line([pts[i],pts[i+1]],fill=col,width=int(w))
# 羽管（半透明）
for i in range(60):
    t=0.17+0.13*i/60; px,py=P(t); r=10
    d.ellipse([px-r,py-r,px+r,py+r],fill=(230,220,196,90))
# --- 金屬筆尖 ---
nib=Image.new("RGBA",(S,S),(0,0,0,0)); nd=ImageDraw.Draw(nib)
def at(t,o): px,py=P(t); return (px+nx*o, py+ny*o)
poly=[at(0.0,0),at(0.07,-17),at(0.175,-24),at(0.19,-20),at(0.19,20),at(0.175,24),at(0.07,17)]
nd.polygon(poly,fill=(255,255,255,255))
mask=nib.split()[3]
grad=Image.new("RGBA",(S,S))
gd=ImageDraw.Draw(grad)
for o in range(-30,31):   # 橫向金屬漸層（亮帶偏一側）
    v=math.exp(-((o-6)/9)**2); base=(150,108,40); hi=(255,236,170)
    c=tuple(int(base[i]+(hi[i]-base[i])*v) for i in range(3))+(255,)
    gd.line([at(-0.05,o),at(0.25,o)],fill=c,width=3)
nibc=Image.new("RGBA",(S,S),(0,0,0,0)); nibc.paste(grad,(0,0),mask)
nd=ImageDraw.Draw(nibc)
nd.line([at(0.0,0),at(0.11,0)],fill=(60,38,12,255),width=4)        # 筆縫
c=at(0.115,0); nd.ellipse([c[0]-7,c[1]-7,c[0]+7,c[1]+7],fill=(60,38,12,255))  # 氣孔
nd.line([at(0.175,-24),at(0.175,24)],fill=(120,84,28,255),width=5)  # 筆尖與羽管接縫
nd.line([at(0.07,-17),at(0.175,-24)],fill=(110,76,24,200),width=3)
img.alpha_composite(nibc)
# 筆尖墨滴
c=at(0.004,0); d=ImageDraw.Draw(img); d.ellipse([c[0]-6,c[1]-4,c[0]+6,c[1]+8],fill=(18,14,10,230))
# --- 陰影 ---
sh=Image.new("RGBA",(S,S),(0,0,0,0)); a=img.split()[3].point(lambda v:int(v*0.55))
sh.putalpha(a); sh=ImageChops.offset(sh,10,16).filter(ImageFilter.GaussianBlur(10))
out=Image.new("RGBA",(S,S),(0,0,0,0)); out.alpha_composite(sh); out.alpha_composite(img)
out=out.resize((160,160),Image.LANCZOS)
out.save("assets/ui/quill.png")
