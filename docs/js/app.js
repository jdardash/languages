// Shared plumbing for every page: storage with graceful degradation,
// settings, fetch with explicit res.ok checks, and autoplay-safe audio.

export const SETTINGS_KEY = "languages:settings:v1";
const mem = new Map();

function storageWorks() {
  try {
    localStorage.setItem("languages:probe", "1");
    localStorage.removeItem("languages:probe");
    return true;
  } catch { return false; }
}

export const store = {
  ok: storageWorks(),
  get(k, fallback) {
    try {
      const raw = this.ok ? localStorage.getItem(k) : mem.get(k);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(k, v) {
    const raw = JSON.stringify(v);
    try { this.ok ? localStorage.setItem(k, raw) : mem.set(k, raw); }
    catch { mem.set(k, raw); this.ok = false; }
  },
};

export function key(lang, kind) { return `languages:${lang}:${kind}:v1`; }

const DEFAULTS = { language: "spanish", rate: 1, drillLimit: 25, shadowIndex: 0, showEnglish: true, drillMode: "recall", listenFirst: false };
export function getSettings() { return { ...DEFAULTS, ...store.get(SETTINGS_KEY, {}) }; }
export function saveSettings(patch) { store.set(SETTINGS_KEY, { ...getSettings(), ...patch }); }

export async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// Browsers reject play() outside a user gesture; the rejection is a promise,
// not an exception, so it must be awaited to be caught.
export async function playAudio(audioEl, src) {
  try {
    if (src) audioEl.src = src;
    await audioEl.play();
    return true;
  } catch { return false; }
}

export function storageWarning(container) {
  if (store.ok) return;
  const p = document.createElement("p");
  p.className = "card";
  p.textContent = "Storage is unavailable in this browser session - progress will not be saved.";
  container.prepend(p);
}

export function markNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach(a => {
    if (a.getAttribute("href") === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
