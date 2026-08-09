import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASES, newPlan, todayKey, dayNumber, weekNumber, tutorDue, phaseZeroDone, checklist,
} from "../docs/js/plan.js";

// Local-time construction so results are timezone-independent.
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const START = "2026-08-01";

test("todayKey formats a local YYYY-MM-DD", () => {
  assert.equal(todayKey(at(2026, 8, 9)), "2026-08-09");
  assert.equal(todayKey(at(2026, 1, 3)), "2026-01-03");
});

test("newPlan starts at phase 0 with phaseStarted = startDate", () => {
  const p = newPlan(START);
  assert.deepEqual(p, { startDate: START, phase: 0, phaseStarted: START });
  assert.equal(newPlan(START, 1).phase, 1);
});

test("dayNumber is 1-based and calendar-day based", () => {
  assert.equal(dayNumber(START, at(2026, 8, 1, 23)), 1);
  assert.equal(dayNumber(START, at(2026, 8, 2, 0)), 2);
  assert.equal(dayNumber(START, at(2026, 8, 15)), 15);
});

test("weekNumber rolls at day 8", () => {
  assert.equal(weekNumber(START, at(2026, 8, 7)), 1);
  assert.equal(weekNumber(START, at(2026, 8, 8)), 2);
  assert.equal(weekNumber(START, at(2026, 9, 5)), 6);   // day 36
});

test("tutorDue fires at week 6, or any time from phase 2", () => {
  const p = newPlan(START);
  assert.equal(tutorDue(p, at(2026, 9, 4)), false);      // day 35, week 5
  assert.equal(tutorDue(p, at(2026, 9, 5)), true);       // day 36, week 6
  assert.equal(tutorDue(newPlan(START, 2), at(2026, 8, 2)), true);
});

test("phaseZeroDone flips on day 15 of phase 0 only", () => {
  const p = newPlan(START);
  assert.equal(phaseZeroDone(p, at(2026, 8, 14)), false); // day 14
  assert.equal(phaseZeroDone(p, at(2026, 8, 15)), true);  // day 15
  assert.equal(phaseZeroDone(newPlan(START, 1), at(2026, 8, 20)), false);
});

test("checklist per phase carries the right engines in order", () => {
  const ids = phase => checklist({ ...newPlan(START), phase }).map(i => i.id);
  assert.deepEqual(ids(0), ["pairs", "capture", "input"]);
  assert.deepEqual(ids(1), ["grammar", "vocab", "drill", "input", "shadow"]);
  assert.deepEqual(ids(2), ["vocab", "drill", "input", "shadow", "tutor"]);
  assert.deepEqual(ids(3), ["vocab", "conversation"]);
  for (const item of checklist(newPlan(START))) {
    assert.equal(typeof item.label, "string");
    assert.ok(item.href, `${item.id} has an href`);
  }
});

test("PHASES describes four phases with names", () => {
  assert.equal(PHASES.length, 4);
  assert.ok(PHASES.every(p => typeof p.name === "string" && typeof p.desc === "string"));
});
