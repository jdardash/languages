import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, diffTokens, accuracy } from "../docs/js/dictation.js";

test("normalize strips punctuation and case but keeps accents", () => {
  assert.equal(normalize("¿Cómo estás, amigo?"), "cómo estás amigo");
  assert.equal(normalize("  Me  acabo   de despertar. "), "me acabo de despertar");
});

test("diffTokens marks matched and missed words", () => {
  const segs = diffTokens("me acabo de despertar", "me acabo despertar");
  assert.deepEqual(segs, [
    { type: "same", text: "me" },
    { type: "same", text: "acabo" },
    { type: "missing", text: "de" },
    { type: "same", text: "despertar" },
  ]);
});

test("diffTokens marks extra typed words", () => {
  const segs = diffTokens("no estoy despierto", "no estoy muy despierto");
  assert.deepEqual(segs, [
    { type: "same", text: "no" },
    { type: "same", text: "estoy" },
    { type: "extra", text: "muy" },
    { type: "same", text: "despierto" },
  ]);
});

test("an accent error is a real error", () => {
  const segs = diffTokens("hablo", "habló");
  assert.deepEqual(segs, [
    { type: "missing", text: "hablo" },
    { type: "extra", text: "habló" },
  ]);
});

test("accuracy is matched words over expected words", () => {
  assert.equal(accuracy("me acabo de despertar", "me acabo de despertar"), 100);
  assert.equal(accuracy("me acabo de despertar", "me acabo despertar"), 75);
  assert.equal(accuracy("hola", ""), 0);
});
