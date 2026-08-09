import { test } from "node:test";
import assert from "node:assert/strict";
import { newCard, nextState, DAY_MS } from "../docs/js/scheduler.js";
import { pickSession, bandStats } from "../docs/js/deck.js";

const NOW = 1_800_000_000_000;
const words = Array.from({ length: 30 }, (_, i) => ({ id: `w-${i + 1}`, rank: i + 1, word: `palabra${i + 1}` }));

function seenCard(dueOffsetDays) {
  const c = nextState(newCard(), "good", NOW - 20 * DAY_MS);
  return { ...c, due: NOW + dueOffsetDays * DAY_MS };
}

test("news come from unseen words in rank order, capped by remaining allowance", () => {
  const schedule = { "w-1": seenCard(5) };
  const { news } = pickSession(words, schedule, 17, NOW, { newPerDay: 20 });
  assert.deepEqual(news.map(w => w.id), ["w-2", "w-3", "w-4"]);
});

test("allowance exhausted means zero news, never negative", () => {
  const { news } = pickSession(words, {}, 20, NOW, { newPerDay: 20 });
  assert.deepEqual(news, []);
  const { news: over } = pickSession(words, {}, 25, NOW, { newPerDay: 20 });
  assert.deepEqual(over, []);
});

test("reviews are only seen-and-due cards, oldest due first, capped at limit", () => {
  const schedule = {
    "w-1": seenCard(-1),   // overdue by a day
    "w-2": seenCard(-3),   // most overdue
    "w-3": seenCard(2),    // not due
    "w-4": seenCard(0),    // due right now
  };
  const { reviews } = pickSession(words, schedule, 0, NOW, { newPerDay: 0 });
  assert.deepEqual(reviews.map(w => w.id), ["w-2", "w-1", "w-4"]);
  const { reviews: capped } = pickSession(words, schedule, 0, NOW, { newPerDay: 0, limit: 2 });
  assert.deepEqual(capped.map(w => w.id), ["w-2", "w-1"]);
});

test("unseen words never appear in reviews", () => {
  const { reviews } = pickSession(words, {}, 0, NOW);
  assert.deepEqual(reviews, []);
});

test("bandStats counts seen and mature per band and skips bands beyond the deck", () => {
  const schedule = {
    "w-1": { ...newCard(), state: "mature", interval: 180, due: NOW + 180 * DAY_MS },
    "w-2": seenCard(1),    // learning
  };
  const stats = bandStats(words, schedule, [10, 30, 100]);
  assert.equal(stats.length, 2);   // 100-band exceeds a 30-word deck
  assert.deepEqual(stats[0], { limit: 10, total: 10, seen: 2, mature: 1, pct: 10 });
  assert.equal(stats[1].total, 30);
});

test("a mark-known mature card counts mature and is not offered as new", () => {
  const schedule = { "w-5": { state: "mature", stepIndex: 0, interval: 180, ease: 2.5, due: NOW + 180 * DAY_MS, lapses: 0, reps: 1 } };
  const { news } = pickSession(words, schedule, 0, NOW, { newPerDay: 5 });
  assert.ok(!news.some(w => w.id === "w-5"));
  assert.equal(bandStats(words, schedule, [10])[0].mature, 1);
});
