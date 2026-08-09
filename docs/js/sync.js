// Gist-backed cross-device sync. The merge is field-level so same-day work on
// two devices both survive: schedules keep the most-progressed card, logs
// union, the plan keeps the furthest phase. Pure logic up top (no DOM, no
// clock); the network wrappers at the bottom are deliberately thin.

export const SYNC_META_KEY = "languages:sync:v1";
const SETTINGS_KEY = "languages:settings:v1";
const GIST_FILE = "languages-progress.json";
const LOG_CAP = 2000;

// Device-local keys that must never travel: preferences and the token itself.
const EXCLUDED = new Set([SETTINGS_KEY, SYNC_META_KEY]);

export function collectState(storage) {
  const state = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k.startsWith("languages:") || EXCLUDED.has(k)) continue;
    try { state[k] = JSON.parse(storage.getItem(k)); } catch { /* skip corrupt */ }
  }
  return state;
}

const kindOf = k => k.split(":")[2];

function unionBy(a = [], b = [], keyFn, cap) {
  const seen = new Map();
  for (const e of [...a, ...b]) {
    const id = keyFn(e);
    if (!seen.has(id)) seen.set(id, e);
  }
  const out = [...seen.values()].sort((x, y) => (x.ts ?? 0) - (y.ts ?? 0));
  return cap ? out.slice(-cap) : out;
}

function mergeCards(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, card] of Object.entries(b)) {
    const mine = out[id];
    if (!mine) { out[id] = card; continue; }
    const winner =
      card.reps > mine.reps ? card :
      card.reps < mine.reps ? mine :
      (card.due ?? 0) >= (mine.due ?? 0) ? card : mine;
    out[id] = winner;
  }
  return out;
}

function mergeKey(kind, local, remote) {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  switch (kind) {
    case "schedule":
    case "vocab-schedule":
      return mergeCards(local, remote);
    case "log":
    case "vocab-log":
      return unionBy(local, remote, e => `${e.ts}:${e.id}`, LOG_CAP);
    case "inputlog":
    case "tutorlog":
    case "checkpoints":
      return unionBy(local, remote, e => e.ts);
    case "captured":
    case "usercards":
      return unionBy(local, remote, e => e.id);
    case "pairs": {
      const out = { ...remote, ...local };
      for (const id of Object.keys(out)) {
        const l = local[id], r = remote[id];
        if (l && r) out[id] = r.seen > l.seen ? r : l;
      }
      return out;
    }
    case "daylog": {
      // A flag checked on either device stays checked.
      const out = { ...remote, ...local };
      for (const day of Object.keys(out)) {
        if (!local[day] || !remote[day]) continue;
        out[day] = { ...remote[day], ...local[day] };
        for (const item of Object.keys(remote[day])) {
          out[day][item] = Boolean(local[day][item]) || Boolean(remote[day][item]);
        }
      }
      return out;
    }
    case "vocab-intro":
      if (local.day === remote.day) return local.count >= remote.count ? local : remote;
      return local.day > remote.day ? local : remote;
    case "plan":
      if (remote.phase !== local.phase) return remote.phase > local.phase ? remote : local;
      return (local.phaseStarted ?? "") >= (remote.phaseStarted ?? "") ? local : remote;
    default:
      return local;   // unknown kinds: local wins, remote only fills gaps
  }
}

export function mergeStates(local, remote) {
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    out[k] = mergeKey(kindOf(k), local[k], remote[k]);
  }
  return out;
}

// --- Network wrappers below: thin, untested, all failures thrown to caller ---

const API = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function pullGist(token, gistId) {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: headers(token) });
  if (!res.ok) throw new Error(`gist read failed: HTTP ${res.status}`);
  const gist = await res.json();
  const file = gist.files?.[GIST_FILE];
  if (!file) return {};
  const text = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  return JSON.parse(text);
}

export async function pushGist(token, gistId, state) {
  const body = JSON.stringify({
    description: "Language-learning progress (auto-synced)",
    public: false,
    files: { [GIST_FILE]: { content: JSON.stringify(state) } },
  });
  const res = await fetch(gistId ? `${API}/gists/${gistId}` : `${API}/gists`, {
    method: gistId ? "PATCH" : "POST",
    headers: headers(token),
    body,
  });
  if (!res.ok) throw new Error(`gist write failed: HTTP ${res.status}`);
  return (await res.json()).id;
}

// Pull, merge, apply locally, push. `store` is the app.js store; `storage` the
// raw localStorage (collectState needs key enumeration, which store lacks).
export async function syncNow(store, storage, now) {
  const meta = store.get(SYNC_META_KEY, {});
  if (!meta.token) return { ok: false, message: "No token saved." };
  const local = collectState(storage);
  const remote = meta.gistId ? await pullGist(meta.token, meta.gistId) : {};
  const merged = mergeStates(local, remote);
  const changed = Object.keys(merged)
    .some(k => JSON.stringify(merged[k]) !== JSON.stringify(local[k]));
  for (const [k, v] of Object.entries(merged)) store.set(k, v);
  const gistId = await pushGist(meta.token, meta.gistId, merged);
  store.set(SYNC_META_KEY, { ...meta, gistId, lastSync: now });
  return { ok: true, message: `Synced ${Object.keys(merged).length} keys.`, gistId, changed };
}
