/* =============================================================
   story.js  故事資料：章節、角色、圖鑑
   ============================================================= */

// 章節。ready = 已經做好（劇本檔 story/<id>.txt 存在）。
export const chapters = [
  { id: "ch1_01", year: 1, n: 1,  title: "長袍店裡的陌生人", ready: true },
  { id: "ch1_02", year: 1, n: 2,  title: "分院儀式", ready: true },
  { id: "ch1_03", year: 1, n: 3,  title: "地窖裡的魔藥課", ready: true },
  // 以下章名暫時順延（章節重排之後劇本聊天室另給清單）
  { id: "ch1_04", year: 1, n: 4,  title: "飛行課與午夜決鬥" },
  { id: "ch1_05", year: 1, n: 5,  title: "萬聖節的巨怪" },
  { id: "ch1_06", year: 1, n: 6,  title: "魁地奇首戰" },
  { id: "ch1_07", year: 1, n: 7,  title: "聖誕節與厄里斯魔鏡" },
  { id: "ch1_08", year: 1, n: 8,  title: "挪威脊背龍與禁林" },
  { id: "ch1_09", year: 1, n: 9,  title: "魔法石的守護" },
  { id: "ch1_10", year: 1, n: 10, title: "（待定）" }
];

export const years = ["一年級", "二年級", "三年級", "四年級"];

// 角色。id = 立繪資料夾名（assets/chara/<id>/<表情>.webp，規格見 docs/sprite_spec.md）與頭像檔名（assets/avatar/<id>.png）
export const characters = {
  // outfits：有這一欄的角色立繪放在 assets/chara/<角色>/<服裝>/<表情>.webp，劇本用 @outfit 切換（跨場景、跨章節沿用）；outfit：預設服裝
  draconia: { name: "馬份",     faces: ["normal", "happy", "sad", "angry", "disdain", "shy", "surprised", "smug", "panic", "cute", "cry"], outfits: ["noble", "school", "slytherin"], outfit: "noble" },   // noble 貴族服、school 黑袍（分院前）、slytherin 史萊哲林校服
  ron:      { name: "榮恩",     faces: ["normal", "happy", "sad", "angry", "surprised"], outfits: ["school", "gryffindor"], outfit: "school" },   // school 黑袍（分院前）、gryffindor 葛來分多校服
  hermione: { name: "妙麗",     faces: ["normal", "happy", "sad", "angry", "shy", "surprised"], outfits: ["school", "gryffindor"], outfit: "school" },   // school 黑袍（分院前）、gryffindor 葛來分多校服
  hagrid:   { name: "海格",     faces: ["normal", "happy", "sad"], scale: 1 },   // scale：立繪縮放倍率（預設 1），高大的角色往上長（原 1.15，頭會被裁切，暫時改回 1）
  molly:    { name: "衛斯理太太", faces: ["normal"] },
  ollivander: { name: "奧利凡德", faces: ["normal"] },
  malkin:   { name: "摩金夫人", faces: ["normal"] },
  crabbe:   { name: "克拉",     faces: ["normal"] },
  goyle:    { name: "高爾",     faces: ["normal"] },
  mcgonagall:  { name: "麥教授",   faces: ["normal"] },
  sorting_hat: { name: "分類帽",   faces: ["normal"] },
  neville:     { name: "奈威",     faces: ["normal"] },
  fred:        { name: "弗雷",     faces: ["normal"] },
  george:      { name: "喬治",     faces: ["normal"] },
  dumbledore:  { name: "鄧不利多", faces: ["normal"] },
  percy:       { name: "派西",     faces: ["normal"] },
  pansy:       { name: "潘西",     faces: ["normal", "happy", "angry", "smug"] },
  snape:       { name: "石內卜",   faces: ["normal", "angry"] }
};

// 沒有立繪、但會說話的人（#名字 不會被當成打錯字）。值 = 頭像檔名
export const speakers = { "哈利": "harry", "？？？": "unknown", "德思禮姨丈": "unknown" };

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
    { id: "cg_duel",     name: "午夜的月光" },
    { id: "cg_mirror",   name: "厄里斯魔鏡" },
    { id: "cg_xmas",     name: "聖誕夜的禮物" },
    { id: "cg_forest",   name: "禁林深處" },
    { id: "cg_stone",    name: "魔法石的守護" },
    // 以下暫定（名稱與圖之後再定）
    { id: "cg_09",       name: "（待定）" },
    { id: "cg_10",       name: "（待定）" },
    { id: "cg_11",       name: "（待定）" },
    { id: "cg_12",       name: "（待定）" },
    { id: "cg_13",       name: "（待定）" },
    { id: "cg_14",       name: "（待定）" },
    { id: "cg_15",       name: "（待定）" },
    { id: "cg_16",       name: "（待定）" },
    { id: "cg_17",       name: "（待定）" },
    { id: "cg_18",       name: "（待定）" },
    { id: "cg_19",       name: "（待定）" },
    { id: "cg_20",       name: "（待定）" }
  ],
  ending: [
    { id: "y1_A", name: "結局：並肩的光" },
    { id: "y1_B", name: "結局：各自的路" },
    { id: "y1_C", name: "結局：陰影之下" },
    { id: "y1_D", name: "結局：被遺忘的約定" },
    // 以下暫定
    { id: "y1_E", name: "結局：（待定）" },
    { id: "y1_F", name: "結局：（待定）" }
  ]
};

// 隱藏數值初始值（新遊戲時）
export const initialFlags = { bond: 50 };
// 數值上下限（自動夾住）
export const flagRange = { bond: [0, 100] };
