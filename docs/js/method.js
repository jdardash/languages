// Renders the method documents (synced copies under docs/method/) client-side
// with the vendored marked build. The doc list is data-driven from the
// manifest; the open document tracks the URL hash so documents are linkable.

import { loadJSON, markNav } from "./app.js";

const $ = id => document.getElementById(id);
markNav();

async function init() {
  try {
    const manifest = await loadJSON("data/manifest.json");
    for (const d of manifest.methodDocs) {
      const a = document.createElement("a");
      a.href = `#${d.file}`;
      a.textContent = d.title;
      a.style.display = "block";
      $("docList").append(a);
    }
    const openFromHash = () => {
      const file = location.hash.slice(1) || manifest.methodDocs[0].file;
      open(file);
    };
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
  } catch (err) { $("doc").textContent = `Could not load documents: ${err.message}`; }
}

async function open(file) {
  // innerHTML is acceptable here only because the source is this repo's own
  // committed markdown, same-origin, path-restricted below. If this page ever
  // renders content from outside the repo, add a sanitizer (DOMPurify) first.
  if (!file.startsWith("method/") || !file.endsWith(".md")) {
    $("doc").textContent = `Not a method document: ${file}`;
    return;
  }
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
    $("doc").innerHTML = window.marked.parse(await res.text());
  } catch (err) { $("doc").textContent = `Could not load ${file}: ${err.message}`; }
}

init();
