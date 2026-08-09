// Sentence capture: the curriculum-authoring step of the island method. Output
// is English; translation happens later, off-page, so capturing stays fast.
// Export matches sentences.csv so the Python pipeline picks it up unchanged.

import { store, key, getSettings, storageWarning, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();
storageWarning($("main"));

const GOAL = [300, 500];
const PROMPTS = [
  "Narrate what you are doing right now, and what you are about to do.",
  "What did you complain about today? Complaints are high-frequency and stick because you mean them.",
  "Explain what you are working on to someone who is not technical.",
  "Where are you from, what do you do, and why did you start?",
  "Tell one of the ten stories you always retell - as the six or eight sentences you actually tell it in.",
  "Order something, ask for the bill, ask how much it costs, ask for the wifi password.",
  "Say you disagree with an approach, and why - without being rude.",
  "What does tomorrow look like? Say it out loud, then type it.",
  "Write five questions you would genuinely ask a stranger, and five for a friend.",
  "Conversation glue: could you say that again more slowly - what does that word mean - I understood about half of that.",
  "Something is overrated. Which thing, and why?",
  "The vocabulary nobody's course contains: your field, your hobbies, your commute, the things you use daily.",
];

let lang, promptIdx = 0;

function items() { return store.get(key(lang, "captured"), []); }

function init() {
  lang = getSettings().language;
  promptIdx = Math.floor(Math.random() * PROMPTS.length);
  $("prompt").textContent = PROMPTS[promptIdx];
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) $("dictate").hidden = false;
  render();
}

function render() {
  const all = items();
  $("goal").textContent = `${all.length} sentences captured`;
  $("fill").style.width = `${Math.min(100, Math.round(100 * all.length / GOAL[0]))}%`;
  const goalNote = all.length >= GOAL[0]
    ? " - enough for the first translation batch" : ` - aim for ${GOAL[0]}-${GOAL[1]} before translating`;
  $("goal").textContent += goalNote;
  $("list").textContent = "";
  for (const it of all.slice(-30).reverse()) {
    const li = document.createElement("li");
    li.textContent = `[${it.topic}] ${it.en} `;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.marginLeft = ".5rem";
    del.addEventListener("click", () => {
      store.set(key(lang, "captured"), items().filter(x => x.id !== it.id));
      render();
    });
    li.append(del);
    $("list").append(li);
  }
}

$("nextPrompt").addEventListener("click", () => {
  promptIdx = (promptIdx + 1) % PROMPTS.length;
  $("prompt").textContent = PROMPTS[promptIdx];
});

$("addBtn").addEventListener("click", () => {
  const lines = $("entry").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;
  const all = items();
  const base = Date.now();
  lines.forEach((en, i) => all.push({ id: base + i, en, topic: $("topic").value, ts: base }));
  store.set(key(lang, "captured"), all);
  $("entry").value = "";
  render();
});

// CSV matching Sentence Islands/<Lang>/sentences.csv - target left blank for
// the translation pass, notes=CAPTURED so merged rows are traceable.
$("exportBtn").addEventListener("click", () => {
  const esc = s => `"${s.replace(/"/g, '""')}"`;
  const rows = items().map((it, i) => `${i + 1},${it.topic},${esc(it.en)},,0,,0,CAPTURED`);
  const csv = ["id,topic,english,target,box,due,misses,notes", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `captured-${lang}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

let rec = null;
$("dictate").addEventListener("click", () => {
  if (rec) { rec.stop(); return; }
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  rec = new SR();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = e => {
    for (const r of e.results) {
      if (!r.isFinal) continue;
      const text = r[0].transcript.trim();
      if (text) $("entry").value = ($("entry").value + "\n" + text).trim();
    }
  };
  rec.onend = () => { rec = null; $("dictate").textContent = "Dictate"; $("dictateStatus").textContent = ""; };
  rec.onerror = () => { $("dictateStatus").textContent = "Dictation unavailable - type instead."; };
  rec.start();
  $("dictate").textContent = "Stop dictating";
  $("dictateStatus").textContent = "Listening - speak whole sentences.";
});

init();

// Tutor corrections -> drill cards prompted with the learner's own error.
function corrections() { return store.get(key(lang, "usercards"), []); }

function renderCorrections() {
  const all = corrections();
  $("corrList").textContent = "";
  for (const c of all.slice(-30).reverse()) {
    const li = document.createElement("li");
    li.append(`${c.attempt} -> `);
    const strong = document.createElement("strong");
    strong.textContent = c.target;
    li.append(strong, " ");
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "small";
    del.addEventListener("click", () => {
      store.set(key(lang, "usercards"), corrections().filter(x => x.id !== c.id));
      renderCorrections();
    });
    li.append(del);
    $("corrList").append(li);
  }
}

$("corrAdd").addEventListener("click", () => {
  const lines = $("corrEntry").value.split("\n").map(l => l.trim()).filter(Boolean);
  const all = corrections();
  let n = 0;
  for (const line of lines) {
    const m = line.split(/->|→/);
    if (m.length !== 2) continue;
    const attempt = m[0].trim(), target = m[1].trim();
    if (!attempt || !target) continue;
    all.push({ id: `u-${Date.now()}-${n++}`, attempt, target, en: `Fix: ${attempt}`, ts: Date.now() });
  }
  if (n) {
    store.set(key(lang, "usercards"), all);
    $("corrEntry").value = "";
  }
  renderCorrections();
});

renderCorrections();
