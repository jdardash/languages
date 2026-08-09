// Pure spaced-repetition scheduler. No DOM, no clock: `now` is always passed
// in (ms epoch), which is what makes this module unit-testable.
// Deliberately simple ladder-plus-ease rather than full FSRS: equal vs
// expanding intervals measure statistically equivalent (Kim & Webb 2022), so
// the win is spacing at all, with long intervals for mature cards.

export const LEARNING_STEPS = [1, 2, 4, 7, 14];
export const DAY_MS = 86_400_000;
const MAX_INTERVAL = 180;
const EASE_FLOOR = 1.3;

export function newCard() {
  return { state: "new", stepIndex: 0, interval: 0, ease: 2.5, due: null, lapses: 0, reps: 0 };
}

export function isDue(card, now) {
  return card.state === "new" || card.due === null || card.due <= now;
}

export function nextState(card, grade, now) {
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
    c.due = now + c.interval * DAY_MS;
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
    c.due = now + c.interval * DAY_MS;
  } else {
    c.stepIndex = next;
    c.due = now + LEARNING_STEPS[next] * DAY_MS;
  }
  return c;
}
