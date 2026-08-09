import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, knownStats } from "../docs/js/readerlib.js";

test("tokenize splits words and keeps separators, accents intact", () => {
  const toks = tokenize("¡Voy a la escuela, señor!");
  const words = toks.filter(t => t.t === "w").map(t => t.w);
  assert.deepEqual(words, ["voy", "a", "la", "escuela", "señor"]);
  assert.equal(toks.map(t => t.s).join(""), "¡Voy a la escuela, señor!");
});

test("knownStats counts repeated words per occurrence", () => {
  const toks = tokenize("la casa y la escuela");
  const stats = knownStats(toks, { la: 2, casa: 1 });
  assert.equal(stats.total, 5);
  assert.equal(stats.known, 2);
  assert.equal(stats.learning, 1);
  assert.equal(stats.pct, 40);
});
