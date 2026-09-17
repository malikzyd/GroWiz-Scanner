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
  fourHour: 3.5 * 60 * 60 * 1000, // ~3.5 hours
};
