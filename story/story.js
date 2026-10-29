/* =============================================================
   story.js  故事資料：章節、角色、圖鑑
   ============================================================= */

// 章節。ready = 已經做好（劇本檔 story/<id>.txt 存在）。
export const chapters = [
  { id: "ch1_01", year: 1, n: 1,  title: "長袍店裡的陌生人", ready: true },
  { id: "ch1_02", year: 1, n: 2,  title: "九又四分之三月台" },
  { id: "ch1_03", year: 1, n: 3,  title: "分院儀式" },
  { id: "ch1_04", year: 1, n: 4,  title: "地窖與禁止的走廊" },
  { id: "ch1_05", year: 1, n: 5,  title: "飛行課與午夜決鬥" },
  { id: "ch1_06", year: 1, n: 6,  title: "萬聖節的巨怪" },
  { id: "ch1_07", year: 1, n: 7,  title: "魁地奇首戰" },
  { id: "ch1_08", year: 1, n: 8,  title: "聖誕節與厄里斯魔鏡" },
  { id: "ch1_09", year: 1, n: 9,  title: "挪威脊背龍與禁林" },
  { id: "ch1_10", year: 1, n: 10, title: "魔法石的守護" }
];

export const years = ["一年級", "二年級", "三年級", "四年級"];

// 角色。id = 立繪資料夾名（assets/chara/<id>/<表情>.png，規格見 docs/sprite_spec.md）與頭像檔名（assets/avatar/<id>.png）
export const characters = {
  draconia: { name: "馬份",     faces: ["normal", "happy", "sad", "angry", "shy", "surprised", "smug"] },
  ron:      { name: "榮恩",     faces: ["normal", "happy", "sad", "angry", "surprised"] },
  hermione: { name: "妙麗",     faces: ["normal", "happy", "sad", "angry", "shy", "surprised"] },
  hagrid:   { name: "海格",     faces: ["normal", "happy", "sad"], scale: 1.15 },   // scale：立繪縮放倍率（預設 1），高大的角色往上長
  molly:    { name: "衛斯理太太", faces: ["normal"] },
  ollivander: { name: "奧利凡德", faces: ["normal"] },
  malkin:   { name: "摩金夫人", faces: ["normal"] },
  crabbe:   { name: "克拉",     faces: ["normal"] },
  goyle:    { name: "高爾",     faces: ["normal"] }
};

// 沒有立繪、但會說話的人（#名字 不會被當成打錯字）。值 = 頭像檔名
export const speakers = { "哈利": "harry", "？？？": "unknown", "德思禮姨丈": "unknown" };

// 圖鑑（圖檔放 assets/cg/<id>.jpg，沒有圖時顯示佔位）
export const cgs = {
  normal: [
    { id: "cg_wandshop", name: "魔杖店．落下的盒子" },
    { id: "cg_platform", name: "九又四分之三月台" },
    { id: "cg_hat",      name: "分院帽之下" },
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
    { id: "cg_20",       name: "（待定）" },
    { id: "cg_21",       name: "（待定）" },
    { id: "cg_22",       name: "（待定）" },
    { id: "cg_23",       name: "（待定）" },
    { id: "cg_24",       name: "（待定）" }
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
