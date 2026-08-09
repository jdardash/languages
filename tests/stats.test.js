import { test } from "node:test";
import assert from "node:assert/strict";
import { forecast } from "../docs/js/stats.js";

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 8, 9);
const DAY_MS = 86_400_000;

test("forecast buckets due dates into local days", () => {
  const cards = [
    { state: "learning", due: NOW + 2 * 3600_000 },        // later today
    { state: "learning", due: at(2026, 8, 10, 1) },        // tomorrow
    { state: "mature", due: at(2026, 8, 15, 23) },         // day 6
  ];
  const f = forecast(cards, NOW, 7);
  assert.equal(f.length, 7);
  assert.equal(f[0].day, "2026-08-09");
  assert.equal(f[0].due, 1);
  assert.equal(f[1].due, 1);
  assert.equal(f[6].due, 1);
});

test("overdue and new cards land on today", () => {
  const cards = [
    { state: "mature", due: NOW - 3 * DAY_MS },
    { state: "new", due: null },
  ];
  const f = forecast(cards, NOW, 7);
  assert.equal(f[0].due, 2);
  assert.equal(f.slice(1).every(b => b.due === 0), true);
});

test("cards beyond the horizon are excluded", () => {
  const cards = [{ state: "mature", due: at(2026, 8, 20) }];
  const f = forecast(cards, NOW, 7);
  assert.equal(f.every(b => b.due === 0), true);
});
