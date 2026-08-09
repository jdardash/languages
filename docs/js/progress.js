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
    const total = data.sentences.length;
    const unseen = total - cards.length;
    const learning = by("new") + by("learning");
    const mature = by("mature");

    $("stats").textContent = "";
    const tile = (value, label) => {
      const d = document.createElement("div");
      d.className = "tile";
      const v = document.createElement("div");
      v.className = "value";
      v.textContent = value;
      const l = document.createElement("div");
      l.className = "label";
      l.textContent = label;
      d.append(v, l);
      return d;
    };
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    tiles.append(
      tile(String(recent.length), "Reviews, last 30 days"),
      tile(recent.length ? `${retention}%` : "-", "Retention, last 30 days"),
      tile(`${mature}/${total}`, "Mature sentences"),
    );

    const segs = [
      ["seg-unseen", unseen, "Unseen"],
      ["seg-learning", learning, "Learning"],
      ["seg-mature", mature, "Mature"],
    ];
    const bar = document.createElement("div");
    bar.className = "stack-bar";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label",
      `${unseen} unseen, ${learning} learning, ${mature} mature of ${total} sentences`);
    for (const [cls, count] of segs) {
      if (!count) continue;
      const s = document.createElement("div");
      s.className = cls;
      s.style.flex = String(count);
      bar.append(s);
    }
    const legend = document.createElement("p");
    legend.className = "stack-legend";
    for (const [cls, count, label] of segs) {
      const item = document.createElement("span");
      const swatch = document.createElement("span");
      swatch.className = `swatch ${cls}`;
      item.append(swatch, `${label} ${count}`);
      legend.append(item);
    }
    $("stats").append(tiles, bar, legend);
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
