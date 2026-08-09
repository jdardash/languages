// Self-assessment checkpoints. Pure: `now` passed in, no DOM. The can-do
// statements are CEFR-flavored but phrased for this method's phases; ratings
// are honest self-report, not a test - phases never lock (see plan.js).

export const CHECKIN_DAYS = 30;
const DAY_MS = 86_400_000;

export const RATINGS = ["Can't yet", "With help", "Mostly", "Easily"];

export const STATEMENTS = {
  0: [
    { id: "p0-rr", text: "I hear r vs rr reliably in words I have never seen" },
    { id: "p0-dr", text: "I hear d vs r between vowels without guessing" },
    { id: "p0-stress", text: "I can point at the stressed syllable of a new word" },
    { id: "p0-echo", text: "I can repeat a short unfamiliar phrase right after hearing it" },
  ],
  1: [
    { id: "p1-intro", text: "I can introduce myself and say what I do and where I live" },
    { id: "p1-daily", text: "I can describe my day in past, present, and future" },
    { id: "p1-shop", text: "I can handle a shop or restaurant exchange without English" },
    { id: "p1-gist", text: "I catch the gist of slow, clear speech on familiar topics" },
    { id: "p1-write", text: "I can write a short message a native would understand" },
  ],
  2: [
    { id: "p2-convo", text: "I can hold a 15-minute conversation on an unprepared topic" },
    { id: "p2-opinion", text: "I can give and defend an opinion, not just narrate" },
    { id: "p2-native", text: "I follow native-speed video with captions comfortably" },
    { id: "p2-repair", text: "When I lack a word, I talk around it instead of stopping" },
    { id: "p2-story", text: "I can retell something that happened to me with detail and timing" },
  ],
  3: [
    { id: "p3-hold", text: "A month without study does not dent my comprehension" },
    { id: "p3-convo", text: "A monthly conversation still feels fluent, not rusty" },
    { id: "p3-media", text: "I consume native media for pleasure, not as practice" },
  ],
};

export function checkpointDue(plan, history, now) {
  if (!plan) return false;
  const last = history.reduce((m, e) => Math.max(m, e.ts), 0);
  return now - last >= CHECKIN_DAYS * DAY_MS;
}

export function record(history, entry) {
  return [...history, entry];
}

export function average(entry) {
  const vals = Object.values(entry.ratings);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
