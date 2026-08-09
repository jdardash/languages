import { test } from "node:test";
import assert from "node:assert/strict";
import { STATEMENTS, RATINGS, checkpointDue, record, average } from "../docs/js/checkpoint.js";

const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;
const plan = { startDate: "2026-08-01", phase: 1, phaseStarted: "2026-08-01" };

test("every phase has statements with unique ids and four rating labels exist", () => {
  for (const phase of [0, 1, 2, 3]) {
    const stmts = STATEMENTS[phase];
    assert.ok(stmts.length >= 3, `phase ${phase} needs statements`);
    assert.equal(new Set(stmts.map(s => s.id)).size, stmts.length);
  }
  assert.equal(RATINGS.length, 4);
});

test("checkpoint is due with empty history", () => {
  assert.equal(checkpointDue(plan, [], NOW), true);
});

test("checkpoint is not due 29 days after the last one, due after 30", () => {
  const at = days => [{ ts: NOW - days * DAY_MS, phase: 1, kind: "monthly", ratings: {} }];
  assert.equal(checkpointDue(plan, at(29), NOW), false);
  assert.equal(checkpointDue(plan, at(31), NOW), true);
});

test("no plan means no checkpoint nag", () => {
  assert.equal(checkpointDue(null, [], NOW), false);
});

test("record appends and returns a new array, input untouched", () => {
  const history = [];
  const entry = { ts: NOW, phase: 1, kind: "advance", ratings: { "p1-convo": 2 } };
  const next = record(history, entry);
  assert.equal(history.length, 0);
  assert.deepEqual(next, [entry]);
});

test("average is the mean rating, null for empty ratings", () => {
  assert.equal(average({ ratings: { a: 1, b: 2, c: 3 } }), 2);
  assert.equal(average({ ratings: {} }), null);
});
