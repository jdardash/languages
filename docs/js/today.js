// The day's dashboard: due count for the active language, settings, and the
// evening-consolidation nudge (informational only, never blocking).

import { newCard, isDue } from "./scheduler.js";
import { store, key, getSettings, saveSettings, loadJSON, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

async function init() {
  try {
    const settings = getSettings();
    const manifest = await loadJSON("data/manifest.json");
    for (const l of manifest.languages) {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.label;
      if (l.id === settings.language) opt.selected = true;
      $("langSel").append(opt);
    }
    $("limit").value = settings.drillLimit;
    const entry = manifest.languages.find(l => l.id === settings.language) ?? manifest.languages[0];
    const data = await loadJSON(entry.data);
    const schedule = store.get(key(data.language, "schedule"), {});
    const now = Date.now();
    const due = data.sentences.filter(s => isDue(schedule[s.id] ?? newCard(), now)).length;
    $("dueLine").textContent = due
      ? `${data.label}: ${Math.min(due, settings.drillLimit)} of ${due} due sentences queued.`
      : `${data.label}: nothing due right now.`;
    $("startBtn").disabled = !due;
    if (new Date().getHours() < 17) $("nudge").hidden = false;
  } catch (err) { $("dueLine").textContent = `Could not load data: ${err.message}`; }
}

$("langSel").addEventListener("change", e => {
  saveSettings({ language: e.target.value });
  location.reload();
});
$("limit").addEventListener("change", e => {
  const v = Math.max(5, Math.min(100, Number(e.target.value) || 25));
  e.target.value = v;
  saveSettings({ drillLimit: v });
});

init();
