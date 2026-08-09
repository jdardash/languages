// Dictation checking: pure text functions, no DOM. Case and punctuation are
// forgiven, accents are not - hearing "hablo" vs "habló" is the point of the
// exercise (transcription forces phoneme-to-orthography mapping; the dictation
// literature is the evidence base here, adopted from Clozemaster's transcribe
// mode and Yabla's Scribe).

export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,;:!?¡¿"'()–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-level LCS alignment: expected-only words are "missing", typed-only
// words are "extra", aligned words are "same".
export function diffTokens(expected, typed) {
  const a = normalize(expected).split(" ").filter(Boolean);
  const b = normalize(typed).split(" ").filter(Boolean);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const segs = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { segs.push({ type: "same", text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) segs.push({ type: "missing", text: a[i++] });
    else segs.push({ type: "extra", text: b[j++] });
  }
  while (i < a.length) segs.push({ type: "missing", text: a[i++] });
  while (j < b.length) segs.push({ type: "extra", text: b[j++] });
  return segs;
}

export function accuracy(expected, typed) {
  const total = normalize(expected).split(" ").filter(Boolean).length;
  if (!total) return 0;
  const same = diffTokens(expected, typed).filter(s => s.type === "same").length;
  return Math.round(100 * same / total);
}
