/* =============================================================
   audio.js  背景音樂、效果音、語音
   檔案：assets/bgm/<名稱>.mp3、assets/sound/<名稱>.mp3、assets/voice/<名稱>.mp3
   手機瀏覽器（尤其 iOS）要等使用者點過畫面才能出聲，所以第一次點擊時解鎖，
   之前排定的背景音樂會在解鎖後自動開始。
   ============================================================= */
import { cfg } from "./core.js";

let bgm = null, bgmName = "", bgmVol = 100, unlocked = false, fadeTimer = null;
const url = (dir, name) => `./assets/${dir}/${name}.mp3`;

function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (bgmName && bgm) bgm.play().catch(() => {});
}
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

function fadeTo(a, target, ms, done) {
  clearInterval(fadeTimer);
  if (!ms) { a.volume = target; if (done) done(); return; }
  const start = a.volume, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, start + (target - start) * k));
    if (k >= 1) { clearInterval(fadeTimer); if (done) done(); }
  }, 40);
}
const masterBgm = () => (cfg().bgm / 100) * (bgmVol / 100);

// name = "" 代表停止
export function playBgm(name, fade = 1000, vol = 100) {
  if (name === bgmName && bgm) return;
  const old = bgm;
  if (old) fadeTo(old, 0, fade, () => old.pause());
  bgmName = name; bgmVol = vol; bgm = null;
  if (!name) return;
  const a = new Audio(url("bgm", name));
  a.loop = true; a.volume = 0;
  bgm = a;
  if (unlocked) a.play().catch(() => {});
  setTimeout(() => fadeTo(a, masterBgm(), fade), 0);
}
export function currentBgm() { return bgmName; }
export function stopAll() { playBgm("", 300); stopVoice(); }

let voice = null;
export function stopVoice() { if (voice) { voice.pause(); voice = null; } }
export function playSe(name, vol = 100) {
  if (!unlocked) return;
  const a = new Audio(url("sound", name));
  a.volume = Math.min(1, (cfg().se / 100) * (vol / 100));
  a.play().catch(() => {});
}
export function playVoice(name, vol = 100) {
  stopVoice();
  if (!unlocked) return;
  voice = new Audio(url("voice", name));
  voice.volume = Math.min(1, (cfg().voice / 100) * (vol / 100));
  voice.play().catch(() => {});
}
// 設定畫面調音量時立即套用
export function applyVolumes() { if (bgm) { clearInterval(fadeTimer); bgm.volume = masterBgm(); } }
