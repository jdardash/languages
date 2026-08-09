// Pure session logic for the frequency core deck. Two queues, WaniKani-style:
// reviews are whatever the clock made due (never throttled), new cards are
// capped per day so review debt cannot explode. `now` is always passed in.

import { isDue } from "./scheduler.js";

export const NEW_PER_DAY = 20;

export function pickSession(words, schedule, introducedToday, now, { newPerDay = NEW_PER_DAY, limit = 60 } = {}) {
  const reviews = words
    .filter(w => schedule[w.id] && isDue(schedule[w.id], now))
    .sort((a, b) => (schedule[a.id].due ?? 0) - (schedule[b.id].due ?? 0))
    .slice(0, limit);
  const allowance = Math.max(0, newPerDay - introducedToday);
  const news = words.filter(w => !schedule[w.id]).slice(0, allowance);
  return { reviews, news };
}

export function bandStats(words, schedule, bands = [100, 250, 500, 1000]) {
  const maxRank = words.reduce((m, w) => Math.max(m, w.rank), 0);
  return bands.filter(b => b <= maxRank).map(limit => {
    const inBand = words.filter(w => w.rank <= limit);
    const seen = inBand.filter(w => schedule[w.id]).length;
    const mature = inBand.filter(w => schedule[w.id]?.state === "mature").length;
    return { limit, total: inBand.length, seen, mature,
             pct: inBand.length ? Math.round(100 * mature / inBand.length) : 0 };
  });
}
