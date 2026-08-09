// Progress stats plus backup. Export/import covers every languages:* key so a
// schedule can move between devices; there is deliberately no sync server.

import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    const schedule = store.get(key(data.language, "schedule"), {});
    const cards = Object.values(schedule);
    const by = state => cards.filter(c => c.state === state).length;
    const log = store.get(key(data.language, "log"), []);
    const cutoff = Date.now() - 30 * 86_400_000;
    const recent = log.filter(e => e.ts >= cutoff);
    const hits = recent.filter(e => e.grade !== "miss").length;
    const retention = recent.length ? Math.round(100 * hits / recent.length) : 0;
    $("heading").textContent = `Progress - ${data.label}`;
    $("stats").textContent = "";
    const p1 = document.createElement("p");
    p1.textContent = `${data.sentences.length} sentences total: ` +
      `${data.sentences.length - cards.length} unseen, ` +
      `${by("new") + by("learning")} learning, ${by("mature")} mature.`;
    const p2 = document.createElement("p");
    p2.textContent = recent.length
      ? `Last 30 days: ${recent.length} reviews, ${retention}% retention.`
      : "No reviews in the last 30 days.";
    $("stats").append(p1, p2);
  } catch (err) { $("stats").textContent = `Could not load data: ${err.message}`; }
}

$("exportBtn").addEventListener("click", () => {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("languages:")) keys[k] = JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), keys }, null, 1)],
    { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `languages-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("backupStatus").textContent = "Exported.";
});

$("importFile").addEventListener("change", async e => {
  try {
    const text = await e.target.files[0].text();
    const parsed = JSON.parse(text);
    if (!parsed.keys || typeof parsed.keys !== "object") throw new Error("not a progress export");
    for (const [k, v] of Object.entries(parsed.keys)) {
      if (k.startsWith("languages:")) store.set(k, v);
    }
    $("backupStatus").textContent = "Imported - reloading.";
    setTimeout(() => location.reload(), 600);
  } catch (err) { $("backupStatus").textContent = `Import failed: ${err.message}`; }
});

init();
