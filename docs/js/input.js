// Input-hour tracking, Dreaming Spanish style: one number, automatic credit
// for in-app shadowing, a two-field manual log for everything else. Milestones
// are DS reference points and labeled as estimates - they gate behavior
// (what to do next), never content.

import { store, key, getSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const MILESTONES = [50, 150, 300, 600, 1000, 1500];
let lang;

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    lang = data.language;
    $("heading").textContent = `Input hours - ${data.label}`;
    $("resources").textContent = "";
    for (const r of (data.resources ?? []).filter(r => r.kind !== "tutor")) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = r.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = r.label;
      li.append(a);
      $("resources").append(li);
    }
    render();
  } catch (err) { $("hours").textContent = `Could not load data: ${err.message}`; }
}

function log() { return store.get(key(lang, "inputlog"), []); }

function render() {
  const entries = log();
  const totalMins = entries.reduce((a, e) => a + e.mins, 0);
  const hours = totalMins / 60;
  $("hours").textContent = `${hours.toFixed(1)} hours`;
  const next = MILESTONES.find(m => m > hours) ?? MILESTONES.at(-1);
  const prev = MILESTONES.filter(m => m <= hours).at(-1) ?? 0;
  const pct = Math.min(100, Math.round(100 * (hours - prev) / (next - prev)));
  $("fill").style.width = `${pct}%`;
  $("milestone").textContent = hours >= MILESTONES.at(-1)
    ? "Past the last reference milestone."
    : `${(next - hours).toFixed(1)} hours to the ${next}-hour reference milestone (estimate, not evidence).`;
  const kinds = {};
  for (const e of entries) kinds[e.kind] = (kinds[e.kind] ?? 0) + e.mins;
  $("byKind").textContent = Object.entries(kinds)
    .map(([k, m]) => `${k}: ${(m / 60).toFixed(1)} h`).join(" - ") || "Nothing logged yet.";
  $("logList").textContent = "";
  for (const e of entries.slice(-14).reverse()) {
    const li = document.createElement("li");
    const when = new Date(e.ts).toLocaleDateString();
    li.textContent = `${when}: ${e.mins} min ${e.kind}${e.note ? ` - ${e.note}` : ""} `;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.marginLeft = ".5rem";
    del.addEventListener("click", () => {
      store.set(key(lang, "inputlog"), log().filter(x => x.ts !== e.ts));
      render();
    });
    li.append(del);
    $("logList").append(li);
  }
}

$("addBtn").addEventListener("click", () => {
  const mins = Math.max(1, Math.min(600, Number($("mins").value) || 0));
  if (!mins) return;
  const entries = log();
  entries.push({ ts: Date.now(), mins, kind: $("kind").value, note: $("note").value.trim() });
  store.set(key(lang, "inputlog"), entries);
  $("note").value = "";
  render();
});

init();
