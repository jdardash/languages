// Reader text logic, DOM-free. Words are compared lowercase NFC; statuses are
// 1 (learning) and 2 (known) in a plain object keyed by word - absent means
// the word has never been marked.

const WORD_RE = /[A-Za-zÀ-ſ]+/gu;

export function tokenize(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) out.push({ t: "x", s: text.slice(last, m.index) });
    out.push({ t: "w", s: m[0], w: m[0].normalize("NFC").toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "x", s: text.slice(last) });
  return out;
}

export function knownStats(tokens, statuses) {
  const words = tokens.filter(t => t.t === "w");
  const known = words.filter(t => statuses[t.w] === 2).length;
  const learning = words.filter(t => statuses[t.w] === 1).length;
  const pct = words.length ? Math.round(100 * known / words.length) : 0;
  return { total: words.length, known, learning, pct };
}
