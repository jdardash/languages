// The day's dashboard: onboarding fork on first visit, then the phase banner,
// today's checklist, the two queues (due reviews vs capped new cards), and the
// tutor card once speaking is due. Phases prescribe, they never lock.

import { newCard, isDue } from "./scheduler.js";
import { store, key, getSettings, saveSettings, loadJSON, storageWarning, markNav } from "./app.js";
import { PHASES, newPlan, todayKey, dayNumber, weekNumber, tutorDue, phaseZeroDone, checklist } from "./plan.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const NEW_PER_DAY = 20;
let lang, data, plan;

const ADVANCE_CHECKS = {
  0: "Self-check: can you reliably hear r vs rr, d vs r, n vs n-tilde, and where the stress falls? Above roughly 85% on every contrast in the pairs trainer means the fortnight has done its job.",
  1: "Self-check: is the grammar book finished and the first 1,000 words mostly mature? That is the milestone - then cards flip to production and tutor sessions become non-negotiable.",
  2: "Self-check: can you hold a real conversation on unprepared topics (roughly B2)? Then park this language high: reviews only, one conversation a month.",
};
const CTA = {
  0: { href: "pairs.html", label: "Start minimal pairs" },
  1: { href: "vocab.html", label: "Start core deck" },
  2: { href: "vocab.html", label: "Start core deck" },
  3: { href: "vocab.html", label: "Do reviews" },
};

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
    data = await loadJSON(entry.data);
    lang = data.language;
    plan = store.get(key(lang, "plan"), null);
    plan ? renderDashboard() : renderSetup();
  } catch (err) {
    $("heading").textContent = `Could not load data: ${err.message}`;
  }
}

function renderSetup() {
  $("setup").hidden = false;
  $("dash").hidden = true;
}

function startPlan(phase) {
  plan = newPlan(todayKey(Date.now()), phase);
  store.set(key(lang, "plan"), plan);
  renderDashboard();
}
$("setupZero").addEventListener("click", () => startPlan(0));
$("setupSome").addEventListener("click", () => startPlan(1));

async function renderDashboard() {
  const now = Date.now();
  $("setup").hidden = true;
  $("dash").hidden = false;

  const ph = PHASES[plan.phase];
  $("phaseLine").textContent =
    `${data.label} - phase ${plan.phase} of 3 - day ${dayNumber(plan.startDate, now)}, week ${weekNumber(plan.startDate, now)}`;
  $("phaseName").textContent = ph.name;
  $("phaseDesc").textContent = ph.desc;

  const check = ADVANCE_CHECKS[plan.phase];
  $("advanceCard").hidden = !check || (plan.phase === 0 && !phaseZeroDone(plan, now));
  if (check) $("advanceCheck").textContent = check;

  renderChecklist(now);
  await renderQueues(now);
  renderTutor(now);

  const cta = CTA[plan.phase];
  $("ctaLink").href = cta.href;
  $("ctaBtn").textContent = cta.label;
  if (new Date(now).getHours() < 17) $("nudge").hidden = false;
}

$("advanceBtn").addEventListener("click", () => {
  plan = { ...plan, phase: Math.min(3, plan.phase + 1), phaseStarted: todayKey(Date.now()) };
  store.set(key(lang, "plan"), plan);
  renderDashboard();
});

function renderChecklist(now) {
  const day = todayKey(now);
  const daylog = store.get(key(lang, "daylog"), {});
  const done = daylog[day] ?? {};
  $("checklist").textContent = "";
  for (const item of checklist(plan)) {
    const label = item.id === "grammar" && data.book
      ? `${item.label} (${data.book.title})` : item.label;
    const li = document.createElement("li");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = Boolean(done[item.id]);
    box.addEventListener("change", () => {
      const log = store.get(key(lang, "daylog"), {});
      log[day] = { ...(log[day] ?? {}), [item.id]: box.checked };
      store.set(key(lang, "daylog"), log);
    });
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = label;
    li.append(box, a);
    $("checklist").append(li);
  }
}

async function renderQueues(now) {
  const schedule = store.get(key(lang, "schedule"), {});
  const islandsDue = data.sentences.filter(s => isDue(schedule[s.id] ?? newCard(), now)).length;
  let totalDue = islandsDue;
  let vocabLine = "";
  try {
    const deck = await loadJSON(`data/vocab-${lang}.json`);
    const vSchedule = store.get(key(lang, "vocab-schedule"), {});
    const due = deck.words.filter(w => vSchedule[w.id] && isDue(vSchedule[w.id], now)).length;
    totalDue += due;
    const unseen = deck.words.filter(w => !vSchedule[w.id]).length;
    const intro = store.get(key(lang, "vocab-intro"), { day: "", count: 0 });
    const introToday = intro.day === todayKey(now) ? intro.count : 0;
    const newAvail = Math.min(unseen, Math.max(0, NEW_PER_DAY - introToday));
    vocabLine = ` Core deck: ${due} reviews due, ${newAvail} new words available today (cap ${NEW_PER_DAY}).`;
  } catch { /* deck not shipped for this language yet */ }
  $("queueLine").textContent = `Islands: ${islandsDue} due.${vocabLine}`;
  $("dueCount").textContent = String(totalDue);
  $("dueCount").hidden = false;
}

function renderTutor(now) {
  if (!tutorDue(plan, now)) { $("tutorCard").hidden = true; return; }
  $("tutorCard").hidden = false;
  $("tutorWhy").textContent = plan.phase >= 3
    ? "Maintenance: one conversation a month keeps speech-rate fluency, the only thing that decays at this level."
    : "Week 6 or later: start speaking, badly, on purpose. Two sessions a week. The instruction below turns a tutor into the d = 0.83 engine - copy it into your first message.";
  const tutorRes = (data.resources ?? []).find(r => r.kind === "tutor");
  $("tutorLink").href = tutorRes ? tutorRes.url : "https://www.italki.com/";
  const sessions = store.get(key(lang, "tutorlog"), []);
  $("tutorCount").textContent = sessions.length
    ? `${sessions.length} sessions logged - last on ${todayKey(sessions.at(-1).ts)}.`
    : "No sessions logged yet.";
  const log = store.get(key(lang, "log"), []);
  const misses = new Map();
  for (const e of log) if (e.grade === "miss") misses.set(e.id, (misses.get(e.id) ?? 0) + 1);
  const worst = [...misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id]) => data.sentences.find(s => s.id === id)).filter(Boolean);
  $("prepWrap").hidden = worst.length === 0;
  $("prepList").textContent = "";
  for (const s of worst) {
    const li = document.createElement("li");
    li.textContent = `${s.en} - ${s.target}`;
    $("prepList").append(li);
  }
}

$("copyInstruction").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("instruction").textContent.trim());
    $("copyInstruction").textContent = "Copied";
  } catch { $("copyInstruction").textContent = "Select and copy manually"; }
});

$("logSession").addEventListener("click", () => {
  const sessions = store.get(key(lang, "tutorlog"), []);
  sessions.push({ ts: Date.now() });
  store.set(key(lang, "tutorlog"), sessions);
  renderTutor(Date.now());
});

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
