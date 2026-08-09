import { test } from "node:test";
import assert from "node:assert/strict";
import { collectState, mergeStates, SYNC_META_KEY } from "../docs/js/sync.js";

const NOW = 1_800_000_000_000;
const K = kind => `languages:spanish:${kind}:v1`;

// Minimal storage stand-in matching the localStorage surface collectState reads.
function fakeStorage(entries) {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: i => keys[i],
    getItem: k => (k in entries ? JSON.stringify(entries[k]) : null),
  };
}

test("collectState gathers languages keys but never settings or sync meta", () => {
  const state = collectState(fakeStorage({
    [K("schedule")]: { "s-1": { reps: 2 } },
    "languages:settings:v1": { rate: 1.5 },
    [SYNC_META_KEY]: { token: "secret" },
    "unrelated:key": { x: 1 },
  }));
  assert.deepEqual(Object.keys(state), [K("schedule")]);
});

test("schedules merge per-card: higher reps wins, tie broken by later due", () => {
  const local = { [K("schedule")]: {
    "s-1": { reps: 5, due: 100, state: "learning" },
    "s-2": { reps: 3, due: 500, state: "learning" },
  } };
  const remote = { [K("schedule")]: {
    "s-1": { reps: 7, due: 50, state: "mature" },
    "s-2": { reps: 3, due: 900, state: "learning" },
    "s-3": { reps: 1, due: 10, state: "new" },
  } };
  const m = mergeStates(local, remote)[K("schedule")];
  assert.equal(m["s-1"].reps, 7);            // remote progressed further
  assert.equal(m["s-2"].due, 900);           // tie on reps, later due wins
  assert.equal(m["s-3"].reps, 1);            // remote-only card survives
});

test("review logs union by ts:id, sort by ts, and keep the 2000 cap", () => {
  const local = { [K("log")]: [
    { ts: 2, grade: "good", id: "a" },
    { ts: 5, grade: "miss", id: "b" },
  ] };
  const remote = { [K("log")]: [
    { ts: 2, grade: "good", id: "a" },       // duplicate
    { ts: 3, grade: "good", id: "c" },
  ] };
  const m = mergeStates(local, remote)[K("log")];
  assert.deepEqual(m.map(e => e.ts), [2, 3, 5]);

  const big = i => ({ ts: i, grade: "good", id: `x${i}` });
  const a = { [K("log")]: Array.from({ length: 1500 }, (_, i) => big(i)) };
  const b = { [K("log")]: Array.from({ length: 1500 }, (_, i) => big(i + 1500)) };
  assert.equal(mergeStates(a, b)[K("log")].length, 2000);
});

test("timestamp logs union by ts alone", () => {
  const local = { [K("tutorlog")]: [{ ts: 1 }, { ts: 3 }] };
  const remote = { [K("tutorlog")]: [{ ts: 3 }, { ts: 2 }] };
  assert.deepEqual(mergeStates(local, remote)[K("tutorlog")].map(e => e.ts), [1, 2, 3]);
});

test("captured sentences union by id, local order first", () => {
  const local = { [K("captured")]: [{ id: "c1", text: "hola" }] };
  const remote = { [K("captured")]: [{ id: "c1", text: "hola" }, { id: "c2", text: "adios" }] };
  assert.deepEqual(mergeStates(local, remote)[K("captured")].map(e => e.id), ["c1", "c2"]);
});

test("pairs stats keep the side with more attempts per contrast", () => {
  const local = { [K("pairs")]: { rr: { seen: 10, correct: 9, last50: [1] } } };
  const remote = { [K("pairs")]: {
    rr: { seen: 4, correct: 2, last50: [0] },
    bv: { seen: 6, correct: 5, last50: [1] },
  } };
  const m = mergeStates(local, remote)[K("pairs")];
  assert.equal(m.rr.seen, 10);
  assert.equal(m.bv.seen, 6);
});

test("daylog ORs item flags per day", () => {
  const local = { [K("daylog")]: { "2026-08-09": { drill: true, vocab: false } } };
  const remote = { [K("daylog")]: { "2026-08-09": { vocab: true }, "2026-08-08": { input: true } } };
  const m = mergeStates(local, remote)[K("daylog")];
  assert.deepEqual(m["2026-08-09"], { drill: true, vocab: true });
  assert.deepEqual(m["2026-08-08"], { input: true });
});

test("vocab-intro takes max count same day, later day otherwise", () => {
  const sameDay = mergeStates(
    { [K("vocab-intro")]: { day: "2026-08-09", count: 12 } },
    { [K("vocab-intro")]: { day: "2026-08-09", count: 7 } },
  )[K("vocab-intro")];
  assert.deepEqual(sameDay, { day: "2026-08-09", count: 12 });

  const laterDay = mergeStates(
    { [K("vocab-intro")]: { day: "2026-08-08", count: 20 } },
    { [K("vocab-intro")]: { day: "2026-08-09", count: 3 } },
  )[K("vocab-intro")];
  assert.deepEqual(laterDay, { day: "2026-08-09", count: 3 });
});

test("plan: higher phase wins, tie to later phaseStarted, null side loses", () => {
  const ahead = mergeStates(
    { [K("plan")]: { startDate: "2026-08-01", phase: 1, phaseStarted: "2026-08-05" } },
    { [K("plan")]: { startDate: "2026-08-01", phase: 2, phaseStarted: "2026-08-07" } },
  )[K("plan")];
  assert.equal(ahead.phase, 2);

  const tie = mergeStates(
    { [K("plan")]: { startDate: "2026-08-01", phase: 1, phaseStarted: "2026-08-06" } },
    { [K("plan")]: { startDate: "2026-08-01", phase: 1, phaseStarted: "2026-08-03" } },
  )[K("plan")];
  assert.equal(tie.phaseStarted, "2026-08-06");

  const oneSided = mergeStates({}, { [K("plan")]: { startDate: "2026-08-01", phase: 0, phaseStarted: "2026-08-01" } });
  assert.equal(oneSided[K("plan")].phase, 0);
});

test("unknown keys: local wins when present, remote fills gaps", () => {
  const m = mergeStates(
    { [K("mystery")]: { a: 1 } },
    { [K("mystery")]: { a: 2 }, [K("other")]: { b: 3 } },
  );
  assert.deepEqual(m[K("mystery")], { a: 1 });
  assert.deepEqual(m[K("other")], { b: 3 });
});

test("merge is idempotent: merging a state with itself changes nothing", () => {
  const state = {
    [K("schedule")]: { "s-1": { reps: 4, due: NOW, state: "learning" } },
    [K("log")]: [{ ts: 1, grade: "good", id: "s-1" }],
    [K("daylog")]: { "2026-08-09": { drill: true } },
    [K("plan")]: { startDate: "2026-08-01", phase: 1, phaseStarted: "2026-08-05" },
  };
  assert.deepEqual(mergeStates(state, state), state);
});

test("divergent same-day work on two devices loses nothing", () => {
  const phone = {
    [K("schedule")]: { "s-1": { reps: 3, due: 300, state: "learning" } },
    [K("log")]: [{ ts: 10, grade: "good", id: "s-1" }],
  };
  const laptop = {
    [K("vocab-schedule")]: { "w-1": { reps: 1, due: 100, state: "new" } },
    [K("vocab-log")]: [{ ts: 20, grade: "good", id: "w-1" }],
  };
  const m = mergeStates(phone, laptop);
  assert.equal(m[K("schedule")]["s-1"].reps, 3);
  assert.equal(m[K("vocab-schedule")]["w-1"].reps, 1);
  assert.equal(m[K("log")].length, 1);
  assert.equal(m[K("vocab-log")].length, 1);
});
