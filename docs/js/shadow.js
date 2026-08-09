// Shadowing player over the per-sentence recorded clips. Rate control keeps
// pitch (preservesPitch); loop-one and auto-advance are mutually exclusive.
// Play time credits itself to the input-hour log in whole minutes.

import { store, key, getSettings, saveSettings, loadJSON, playAudio, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();

let clips = [], i = 0, lang = null;
const player = $("player");

let listenedMs = 0, playStart = null;
player.addEventListener("play", () => { playStart = Date.now(); });
player.addEventListener("pause", () => {
  if (playStart) { listenedMs += Date.now() - playStart; playStart = null; }
  creditListening();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  if (playStart) { listenedMs += Date.now() - playStart; playStart = null; }
  creditListening();
});

function creditListening() {
  const mins = Math.floor(listenedMs / 60_000);
  if (!mins || !lang) return;
  listenedMs -= mins * 60_000;
  const log = store.get(key(lang, "inputlog"), []);
  log.push({ ts: Date.now(), mins, kind: "shadow", note: "" });
  store.set(key(lang, "inputlog"), log);
}

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    lang = data.language;
    clips = data.sentences.filter(s => s.audio);
    $("target").lang = data.bcp47;
    if (!clips.length) { $("status").textContent = "No recorded audio for this language yet."; return; }
    i = Math.min(settings.shadowIndex, clips.length - 1);
    $("rate").value = String(settings.rate);
    setEnglish(settings.showEnglish);
    $("status").hidden = true;
    $("stage").hidden = false;
    $("heading").textContent = `Shadow - ${data.label}`;
    render();
  } catch (err) { $("status").textContent = `Could not load data: ${err.message}`; }
}

function render() {
  const s = clips[i];
  $("counter").textContent = `${i + 1} / ${clips.length} - ${s.topic}`;
  $("target").textContent = s.target;
  $("english").textContent = s.en;
  saveSettings({ shadowIndex: i });
}

async function play() {
  player.playbackRate = Number($("rate").value);
  if ("preservesPitch" in player) player.preservesPitch = true;
  const ok = await playAudio(player, clips[i].audio);
  $("playBtn").textContent = ok ? "Pause" : "Tap to play";
}

$("playBtn").addEventListener("click", () => {
  if (player.paused) play(); else { player.pause(); $("playBtn").textContent = "Play"; }
});
$("prev").addEventListener("click", () => { i = (i - 1 + clips.length) % clips.length; render(); play(); });
$("next").addEventListener("click", () => { i = (i + 1) % clips.length; render(); play(); });

function toggle(btn) {
  const on = btn.getAttribute("aria-pressed") !== "true";
  btn.setAttribute("aria-pressed", String(on));
  return on;
}
$("loop").addEventListener("click", e => { if (toggle(e.currentTarget)) $("chain").setAttribute("aria-pressed", "false"); });
$("chain").addEventListener("click", e => { if (toggle(e.currentTarget)) $("loop").setAttribute("aria-pressed", "false"); });
$("rate").addEventListener("change", () => {
  saveSettings({ rate: Number($("rate").value) });
  player.playbackRate = Number($("rate").value);
});
$("toggleEn").addEventListener("click", e => setEnglish(toggle(e.currentTarget)));

function setEnglish(on) {
  $("english").hidden = !on;
  $("toggleEn").setAttribute("aria-pressed", String(on));
  saveSettings({ showEnglish: on });
}

player.addEventListener("ended", () => {
  if ($("loop").getAttribute("aria-pressed") === "true") { play(); return; }
  if ($("chain").getAttribute("aria-pressed") === "true") {
    setTimeout(() => { i = (i + 1) % clips.length; render(); play(); }, 1200);
  } else $("playBtn").textContent = "Play";
});

document.addEventListener("keydown", e => {
  if ($("stage").hidden || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
  if (e.key === " ") { e.preventDefault(); $("playBtn").click(); }
  if (e.key === "ArrowRight") $("next").click();
  if (e.key === "ArrowLeft") $("prev").click();
});

init();
