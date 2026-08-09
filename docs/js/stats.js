// Review forecast: due counts per local day - the "come back tomorrow"
// mechanic that needs no notifications. Pure; `now` passed in.

export function forecast(cards, now, days = 7) {
  const d = new Date(now);
  const bucket = i => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
  const pad = n => String(n).padStart(2, "0");
  const out = [];
  for (let i = 0; i < days; i++) {
    const start = bucket(i).getTime();
    const end = bucket(i + 1).getTime();
    const due = cards.filter(c => {
      if (c.state === "new" || c.due == null) return i === 0;
      if (i === 0) return c.due < end;              // overdue folds into today
      return c.due >= start && c.due < end;
    }).length;
    const b = bucket(i);
    out.push({ day: `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}`, due });
  }
  return out;
}
