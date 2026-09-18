// src/lib/rateLimiter.js
//
// Twelve Data's free tier allows ~8 requests/minute. Previously, forex
// calls across daily/1H/15min/5min for a pair had no shared pacing, so a
// full scan could burst way past that limit and Twelve Data would start
// silently rejecting requests — those errors were then hidden from the
// UI (see ScannerDashboard's old error-filtering), so forex pairs looked
// like they just weren't being analyzed. This queue serializes every
// Twelve-Data-bound call, app-wide, at a safe interval.

const MIN_INTERVAL_MS = 7500; // ~8/min with margin
let queue = Promise.resolve();

export function runPaced(fn) {
  const result = queue.then(() => fn());
  queue = result.catch(() => {}).then(() => new Promise((r) => setTimeout(r, MIN_INTERVAL_MS)));
  return result;
}
