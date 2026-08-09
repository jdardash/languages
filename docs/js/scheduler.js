// Pure spaced-repetition scheduler. No DOM, no clock: `now` is always passed
// in (ms epoch), which is what makes this module unit-testable.
// Deliberately simple ladder-plus-ease rather than full FSRS. The honest
// rationale: FSRS's benchmarked edge is prediction calibration, worth ~20-30%
// fewer reviews on mature ten-thousand-card decks; on a personal deck under
// five thousand cards that is minutes a day, not worth a state migration.
// (Kim & Webb 2022 - equal vs expanding intervals equivalent - covers the
// interval *shape* only, not the scheduler choice.) Two FSRS-adjacent
// mechanics are worth having and live here: deterministic due-date fuzz so
// reviews don't pile onto the same day, and leech flagging (Anki) so
// chronically failed cards get rewritten instead of ground.

export const LEARNING_STEPS = [1, 2, 4, 7, 14];
export const DAY_MS = 86_400_000;
export const LEECH_LAPSES = 4;
const MAX_INTERVAL = 180;
const EASE_FLOOR = 1.3;
const FUZZ_MIN_DAYS = 7;

export function isLeech(card) {
  return card.lapses >= LEECH_LAPSES;
}

// Stable card-id hash so callers can seed the due-date fuzz.
export function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h;
}

// Spread long-interval due dates by up to +/-5% so cards graded together do
// not stay due together forever. Seeded and pure: same seed, same offset.
function fuzzMs(interval, seed) {
  if (interval < FUZZ_MIN_DAYS || seed === undefined) return 0;
  const span = Math.round(interval * 0.05);
  if (span < 1) return 0;
  const h = (Math.imul(seed + interval, 2654435761) >>> 0) % (2 * span + 1);
  return (h - span) * DAY_MS;
}

export function newCard() {
  return { state: "new", stepIndex: 0, interval: 0, ease: 2.5, due: null, lapses: 0, reps: 0 };
}

export function isDue(card, now) {
  return card.state === "new" || card.due === null || card.due <= now;
}

export function nextState(card, grade, now, seed) {
  const c = { ...card, reps: card.reps + 1 };
  if (grade === "miss") {
    c.lapses = card.lapses + 1;
    c.ease = Math.max(EASE_FLOOR, card.ease - 0.2);
    c.state = "learning";
    c.stepIndex = 0;
    c.due = now + LEARNING_STEPS[0] * DAY_MS;
    return c;
  }
  if (card.state === "mature") {
    if (grade === "hard") {
      c.ease = Math.max(EASE_FLOOR, card.ease - 0.15);
      c.interval = Math.max(1, Math.round(card.interval * 1.2));
    } else {
      c.interval = Math.round(card.interval * card.ease);
    }
    c.interval = Math.min(MAX_INTERVAL, c.interval);
    c.due = now + c.interval * DAY_MS + fuzzMs(c.interval, seed);
    return c;
  }
  // new or learning
  c.state = "learning";
  if (grade === "hard") {
    c.due = now + LEARNING_STEPS[card.stepIndex] * DAY_MS;
    return c;
  }
  const next = card.state === "new" ? 0 : card.stepIndex + 1;
  if (next >= LEARNING_STEPS.length) {
    c.state = "mature";
    c.interval = Math.min(MAX_INTERVAL, Math.round(LEARNING_STEPS.at(-1) * card.ease));
    c.due = now + c.interval * DAY_MS + fuzzMs(c.interval, seed);
  } else {
    c.stepIndex = next;
    c.due = now + LEARNING_STEPS[next] * DAY_MS;
  }
  return c;
}
