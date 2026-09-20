// src/lib/cache.js

export function getCached(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage full or unavailable — fail silently, just means no caching this time
  }
}

export const CACHE_TTL = {
  daily: 20 * 60 * 60 * 1000, // ~20 hours
  fourHour: 3.5 * 60 * 60 * 1000, // ~3.5 hours (legacy, unused by current funnel)
  oneHour: 45 * 60 * 1000, // ~45 minutes — 1H structure doesn't change scan-to-scan
  fifteenMin: 8 * 60 * 1000, // ~8 minutes
};
