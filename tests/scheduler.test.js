import { test } from "node:test";
import assert from "node:assert/strict";
import { newCard, nextState, isDue, isLeech, seedFrom, LEARNING_STEPS, DAY_MS } from "../docs/js/scheduler.js";

const NOW = 1_800_000_000_000;

test("new card is due and pristine", () => {
  const c = newCard();
  assert.equal(c.state, "new");
  assert.equal(isDue(c, NOW), true);
});

test("good climbs the learning ladder", () => {
  let c = newCard();
  c = nextState(c, "good", NOW);
  assert.equal(c.state, "learning");
  assert.equal(c.due, NOW + LEARNING_STEPS[0] * DAY_MS);
  c = nextState(c, "good", NOW);
  assert.equal(c.due, NOW + LEARNING_STEPS[1] * DAY_MS);
});

test("finishing the ladder matures with interval = last step * ease", () => {
  let c = newCard();
  for (let i = 0; i <= LEARNING_STEPS.length; i++) c = nextState(c, "good", NOW);
  assert.equal(c.state, "mature");
  assert.equal(c.interval, Math.round(14 * 2.5));
});

test("miss lapses a mature card back to step 0 and drops ease", () => {
  let c = { state: "mature", stepIndex: 0, interval: 35, ease: 2.5, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "miss", NOW);
  assert.equal(c.state, "learning");
  assert.equal(c.stepIndex, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.ease, 2.3);
});

test("ease never drops below 1.3 and interval caps at 180", () => {
  let c = { state: "mature", stepIndex: 0, interval: 170, ease: 1.31, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "good", NOW);
  assert.equal(c.interval, 180);
  let d = { state: "mature", stepIndex: 0, interval: 10, ease: 1.3, due: NOW, lapses: 0, reps: 9 };
  d = nextState(d, "miss", NOW);
  assert.equal(d.ease, 1.3);
});

test("hard on mature grows slowly and reduces ease", () => {
  let c = { state: "mature", stepIndex: 0, interval: 30, ease: 2.0, due: NOW, lapses: 0, reps: 9 };
  c = nextState(c, "hard", NOW);
  assert.equal(c.interval, 36);
  assert.equal(c.ease, 1.85);
});

test("hard on learning repeats the current step without advancing", () => {
  let c = newCard();
  c = nextState(c, "good", NOW);          // learning, stepIndex 0
  c = nextState(c, "hard", NOW);
  assert.equal(c.state, "learning");
  assert.equal(c.stepIndex, 0);
  assert.equal(c.due, NOW + LEARNING_STEPS[0] * DAY_MS);
});

test("scheduled cards are not due before their date and due after", () => {
  let c = newCard();
  c = nextState(c, "good", NOW);
  assert.equal(isDue(c, NOW + DAY_MS - 1), false);
  assert.equal(isDue(c, NOW + DAY_MS), true);
});

test("nextState does not mutate its input", () => {
  const c = newCard();
  nextState(c, "good", NOW);
  assert.equal(c.state, "new");
});

test("leech: flagged at the fourth lapse, not before", () => {
  const c = { ...newCard(), lapses: 3 };
  assert.equal(isLeech(c), false);
  assert.equal(isLeech({ ...c, lapses: 4 }), true);
  assert.equal(isLeech({ ...c, lapses: 9 }), true);
});

test("seeded scheduling fuzzes long due dates within 5% and stays deterministic", () => {
  const mature = { state: "mature", stepIndex: 0, interval: 60, ease: 2.5, due: NOW, lapses: 0, reps: 9 };
  const a = nextState(mature, "good", NOW, 42);
  const b = nextState(mature, "good", NOW, 42);
  assert.equal(a.due, b.due);                       // deterministic per seed
  assert.equal(a.interval, Math.min(150, 180));     // interval itself unfuzzed
  const exact = NOW + a.interval * DAY_MS;
  const span = Math.round(a.interval * 0.05) * DAY_MS;
  assert.ok(Math.abs(a.due - exact) <= span);
  const dues = new Set();
  for (let seed = 0; seed < 20; seed++) dues.add(nextState(mature, "good", NOW, seed).due);
  assert.ok(dues.size > 5);                         // seeds spread across the fuzz window
});

test("seeded scheduling leaves short learning steps exact", () => {
  const c = nextState(newCard(), "good", NOW, 42);
  assert.equal(c.due, NOW + LEARNING_STEPS[0] * DAY_MS);
});

test("unseeded calls stay exact for backward compatibility", () => {
  const mature = { state: "mature", stepIndex: 0, interval: 60, ease: 2.5, due: NOW, lapses: 0, reps: 9 };
  const c = nextState(mature, "good", NOW);
  assert.equal(c.due, NOW + c.interval * DAY_MS);
});

test("seedFrom hashes strings deterministically to ints", () => {
  assert.equal(seedFrom("s-14"), seedFrom("s-14"));
  assert.notEqual(seedFrom("s-14"), seedFrom("s-15"));
  assert.equal(typeof seedFrom("w-203"), "number");
});
