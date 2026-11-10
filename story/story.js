/* =============================================================
   story.js  故事資料：章節、角色、圖鑑
   ============================================================= */

// 章節。ready = 已經做好（劇本檔 story/<id>.txt 存在）。
export const chapters = [
  { id: "ch1_01", year: 1, n: 1,  title: "長袍店裡的陌生人", ready: true },
  { id: "ch1_02", year: 1, n: 2,  title: "分院儀式", ready: true },
  { id: "ch1_03", year: 1, n: 3,  title: "地窖裡的魔藥課", ready: true },
  { id: "ch1_04", year: 1, n: 4,  title: "飛行課與記憶球", ready: true },
  { id: "ch1_05", year: 1, n: 5,  title: "午夜決鬥", ready: true },
  { id: "ch1_06", year: 1, n: 6,  title: "萬聖節的山怪", ready: true },
  { id: "ch1_07", year: 1, n: 7,  title: "魁地奇首戰", ready: true },
  { id: "ch1_08", year: 1, n: 8,  title: "聖誕節與厄里斯魔鏡", ready: true },
  { id: "ch1_09", year: 1, n: 9,  title: "挪威脊背龍", ready: true },
  { id: "ch1_10", year: 1, n: 10, title: "禁忌森林", ready: true },
  { id: "ch1_11", year: 1, n: 11, title: "活板門之下" },
  { id: "ch1_12", year: 1, n: 12, title: "（暫定）醫院廂房與學年末宴會" }
];

export const years = ["一年級", "二年級", "三年級", "四年級"];

// 角色。id = 立繪資料夾名（assets/chara/<id>/<表情>.webp，規格見 docs/sprite_spec.md）與頭像檔名（assets/avatar/<id>.png）
export const characters = {
  // outfits：有這一欄的角色立繪放在 assets/chara/<角色>/<服裝>/<表情>.webp，劇本用 @outfit 切換（跨場景、跨章節沿用）；outfit：預設服裝
  draconia: { name: "馬份",     faces: ["normal", "happy", "sad", "angry", "disdain", "shy", "surprised", "smug", "panic", "cute", "cry"], outfits: ["casual", "slytherin", "winter"], outfit: "casual" },   // casual 貴族服（便服）（入學前到分院前）、slytherin 史萊哲林校服（分院後）、winter 冬裝（史萊哲林校服＋頸巾，表情同校服）
  ron:      { name: "榮恩",     faces: ["normal", "happy", "sad", "angry", "surprised", "disdain", "shy", "panic"], outfits: ["casual", "gryffindor", "winter"], outfit: "casual" },   // casual 便服（分院前）、gryffindor 葛來分多校服、winter 冬裝（校服＋頸巾）
  hermione: { name: "妙麗",     faces: ["normal", "happy", "sad", "angry", "shy", "surprised", "cry", "panic"], outfits: ["casual", "gryffindor", "winter"], outfit: "casual" },   // casual 便服（分院前）、gryffindor 葛來分多校服、winter 冬裝（校服＋頸巾）
  hagrid:   { name: "海格",     faces: ["normal", "happy", "sad"], scale: 1 },   // scale：立繪縮放倍率（預設 1），高大的角色往上長（原 1.15，頭會被裁切，暫時改回 1）
  molly:    { name: "茉莉", faces: ["normal"] },
  ollivander: { name: "奧利凡德", faces: ["normal"] },   // 黑影立繪
  malkin:   { name: "摩金夫人", faces: ["normal"] },   // 黑影立繪
  crabbe:   { name: "克拉",     faces: ["normal"], outfits: ["casual", "slytherin"], outfit: "casual" },   // casual 便服（分院前）、slytherin 史萊哲林校服
  goyle:    { name: "高爾",     faces: ["normal"], outfits: ["casual", "slytherin"], outfit: "casual" },
  mcgonagall:  { name: "麥教授",   faces: ["normal"] },
  sorting_hat: { name: "分類帽",   faces: ["normal"] },
  neville:     { name: "奈威",     faces: ["normal", "happy", "sad", "cry", "panic"], outfits: ["casual", "gryffindor"], outfit: "casual" },
  fred:        { name: "弗雷",     faces: ["normal"] },
  george:      { name: "喬治",     faces: ["normal"] },
  dumbledore:  { name: "鄧不利多", faces: ["normal"] },
  percy:       { name: "派西",     faces: ["normal"] },
  pansy:       { name: "潘西",     faces: ["normal", "happy", "angry", "smug", "disdain", "surprised", "panic", "cry"] },
  snape:       { name: "石內卜",   faces: ["normal", "angry"] },
  hooch:       { name: "胡奇夫人", faces: ["normal"] },   // 黑影立繪
  wood:        { name: "木透",     faces: ["normal"] },
  flitwick:    { name: "孚立維教授", faces: ["normal"] },   // 黑影立繪
  quirrell:    { name: "奎若教授",   faces: ["normal"] },
  filch:       { name: "飛七",     faces: ["normal"] },
  firenze:     { name: "翡冷翠",   faces: ["normal"] },   // 人馬
  peeves:      { name: "皮皮鬼",   faces: ["normal"] },
  flint:       { name: "弗林",     faces: ["normal"] },   // 黑影立繪
  pince:       { name: "平斯夫人", faces: ["normal"] },   // 黑影立繪
  lee:         { name: "李．喬丹", faces: ["normal"] },   // 只出聲音、從不 @show；頭像暫用 unknown 的圖
  unknown:     { name: "？？？",     faces: ["normal"] }   // 刻意隱藏身分的說話者共用：無形黑影立繪（說話者寫 #？？？，用 @show unknown 上台）；頭像 assets/avatar/unknown.png
};

// 沒有立繪、但會說話的人（#名字 不會被當成打錯字）。值 = 頭像檔名
export const speakers = { "哈利": "harry", "德思禮姨丈": "unknown" };

// 圖鑑（圖檔放 assets/cg/<id>.webp，沒有圖時顯示佔位）
// pos：CG 裁切焦點（"水平% 垂直%"，預設 "50% 50%"）。CG 是方圖，橫向會裁上下、直向會裁左右，焦點決定保留哪一塊；由立繪聊天室量好後填入
export const cgs = {
  normal: [
    { id: "cg_robeshop", name: "長袍店的初遇", pos: "50% 4%" },
    { id: "cg_wandshop", name: "魔杖店．落下的盒子", pos: "50% 40%" },
    { id: "cg_handshake", name: "伸出的手" },
    { id: "cg_hat",      name: "分類帽下的她" },
    { id: "cg_song",     name: "星空下的校歌" },
    { id: "cg_library",  name: "書本後的臉" },
    { id: "cg_mouth",    name: "地窖裡的嘴型" },
    { id: "cg_flight",   name: "空中握住的手" },
    { id: "cg_remembrall", name: "草地上的記憶球" },
    { id: "cg_duel",     name: "午夜的月光" },
    { id: "cg_closet",   name: "櫃子裡" },
    { id: "cg_fluffy",   name: "緊抓袍角的手" },
    { id: "cg_fluffy_b", name: "身後的同伴" },
    { id: "cg_broom",    name: "捧著光輪的她" },
    { id: "cg_pitch_solo", name: "夕陽下的光輪" },
    { id: "cg_pitch_duo",  name: "並肩的晚霞" },
    { id: "cg_troll",      name: "山怪背上" },
    { id: "cg_shield",     name: "護在身後的人" },
    { id: "cg_candy",      name: "掌心裡的糖" },
    { id: "cg_stands",     name: "看台上的她" },
    { id: "cg_handkerchief", name: "手帕" },
    { id: "cg_gift_hall", name: "走廊上的禮物" },
    { id: "cg_cracker",  name: "拉炮裡的花帽子" },
    { id: "cg_xmas",     name: "聖誕節早晨的禮物" },
    { id: "cg_mirror",   name: "厄里斯魔鏡" },
    { id: "cg_cloak",    name: "斗篷下的兩人" },
    { id: "cg_mirror_her", name: "鏡前的她" },
    { id: "cg_norbert",  name: "破殼的蘿蔔" },
    { id: "cg_tower",    name: "飛向夜空的蘿蔔" },
    { id: "cg_sleeve",   name: "禁忌森林裡的手" },
    { id: "cg_shadow",   name: "戴著兜帽的黑影" },
    { id: "cg_tears",    name: "月光下的眼淚" },
    { id: "cg_stone",    name: "魔法石的守護" },
    // 以下暫定（名稱與圖之後再定）
    { id: "cg_21",       name: "（待定）" },
    { id: "cg_22",       name: "（待定）" },
    { id: "cg_23",       name: "（待定）" },
    { id: "cg_24",       name: "（待定）" },
    { id: "cg_25",       name: "（待定）" },
    { id: "cg_26",       name: "（待定）" },
    { id: "cg_27",       name: "（待定）" },
    { id: "cg_28",       name: "（待定）" },
    { id: "cg_29",       name: "（待定）" },
    { id: "cg_30",       name: "（待定）" },
    { id: "cg_31",       name: "（待定）" },
    { id: "cg_32",       name: "（待定）" },
    { id: "cg_33",       name: "（待定）" },
    { id: "cg_34",       name: "（待定）" },
    { id: "cg_35",       name: "（待定）" },
    { id: "cg_36",       name: "（待定）" },
    { id: "cg_37",       name: "（待定）" },
    { id: "cg_38",       name: "（待定）" },
    { id: "cg_39",       name: "（待定）" },
    { id: "cg_40",       name: "（待定）" },
    { id: "cg_41",       name: "（待定）" },
    { id: "cg_42",       name: "（待定）" },
    { id: "cg_43",       name: "（待定）" },
    { id: "cg_44",       name: "（待定）" },
    { id: "cg_45",       name: "（待定）" },
    { id: "cg_46",       name: "（待定）" },
    { id: "cg_47",       name: "（待定）" }
  ],
  ending: [   // line：年級結算頁的結局語句（可用 \n 換行）
    { id: "y1_A", name: "結局：（待定）", line: "" },
    { id: "y1_B", name: "結局：（待定）", line: "" },
    { id: "y1_C", name: "結局：（待定）", line: "" },
    { id: "y1_D", name: "結局：（待定）", line: "" },
    { id: "y1_E", name: "結局：（待定）", line: "" },
    { id: "y1_F", name: "結局：（待定）", line: "" }
  ]
};

// 隱藏數值初始值（新遊戲時）
export const initialFlags = { bond: 50 };
// 數值上下限（自動夾住）
export const flagRange = { bond: [0, 100] };
