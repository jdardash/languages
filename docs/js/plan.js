// Phase model for the guided path. Pure: `now` is always passed in (ms epoch).
// Phases prescribe activities, they never lock pages - the graduation mechanic
// is a self-check, not a test (serverless has no honest way to examine you).

export const PHASES = [
  { id: 0, name: "Sound system", focus: "pairs",
    desc: "Two weeks of ear training before volume. Perception errors fossilize into every word learned afterward - this fortnight is cheap insurance you can never buy again later." },
  { id: 1, name: "Core 1,000 + grammar spine", focus: "vocab",
    desc: "Frequency deck at 20 new words a day, the fundamental book worked closed-book, graded input daily. Start speaking at week 6, badly, on purpose." },
  { id: 2, name: "1,000 to 5,000 + conversation", focus: "hours",
    desc: "Flip to production, shift input toward native with captions, two tutor sessions a week. 95% coverage is where the language becomes usable rather than studied." },
  { id: 3, name: "Maintenance", focus: "hours",
    desc: "Reviews only, long intervals, zero new cards, one conversation a month. Skills parked high are nearly free to keep." },
];

const DAY_MS = 86_400_000;

export function todayKey(now) {
  const d = new Date(now);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newPlan(startDate, phase = 0) {
  return { startDate, phase, phaseStarted: startDate };
}

function localMidnight(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function dayNumber(startDate, now) {
  const d = new Date(now);
  const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((todayStart - localMidnight(startDate)) / DAY_MS) + 1;
}

export function weekNumber(startDate, now) {
  return Math.ceil(dayNumber(startDate, now) / 7);
}

export function tutorDue(plan, now) {
  return plan.phase >= 2 || weekNumber(plan.startDate, now) >= 6;
}

export function phaseZeroDone(plan, now) {
  return plan.phase === 0 && dayNumber(plan.phaseStarted, now) > 14;
}

const CHECKLISTS = {
  0: [
    { id: "pairs", label: "Minimal pairs - 10 minutes, before anything else", href: "pairs.html" },
    { id: "capture", label: "Capture sentences - narrate your day, speech-to-text on", href: "capture.html" },
    { id: "input", label: "Graded listening in dead time", href: "input.html" },
  ],
  1: [
    { id: "grammar", label: "Grammar spine - exercises closed-book, morning", href: "method.html" },
    { id: "vocab", label: "Core deck - reviews plus new words", href: "vocab.html" },
    { id: "drill", label: "Island drill - say it out loud, evening", href: "drill.html" },
    { id: "input", label: "Input - graded audio plus captioned video", href: "input.html" },
    { id: "shadow", label: "Shadow in dead time", href: "shadow.html" },
  ],
  2: [
    { id: "vocab", label: "Core deck - production direction", href: "vocab.html" },
    { id: "drill", label: "Island drill", href: "drill.html" },
    { id: "input", label: "Native input with captions", href: "input.html" },
    { id: "shadow", label: "Shadow in dead time", href: "shadow.html" },
    { id: "tutor", label: "Tutor session prep - bring your worst sentences", href: "index.html#tutor" },
  ],
  3: [
    { id: "vocab", label: "Reviews only - zero new cards", href: "vocab.html" },
    { id: "conversation", label: "One conversation this month", href: "index.html#tutor" },
  ],
};

export function checklist(plan) {
  return CHECKLISTS[plan.phase] ?? CHECKLISTS[1];
}
