// src/lib/scanGate.js
import { supabase } from "./supabaseClient";
import { getPlanConfig, FREE_FOREX_PAIRS, FREE_CRYPTO_PAIRS, FREE_COMMODITY_PAIRS } from "./plans";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Always reads the LIVE count from the DB first — never trusts a
// possibly-stale profile object passed in from a page load that happened
// before earlier scans were consumed. This is what fixes the "limit never
// triggers" bug: the old version only ever checked the profile snapshot
// from page-load, which never updated after a scan.
export async function getLiveScanStatus(userId, planKey) {
  const plan = getPlanConfig(planKey);
  if (plan.scansPerDay === Infinity) return { used: 0, limit: Infinity, plan };

  const { data } = await supabase
    .from("subscribers")
    .select("scans_used_today, scan_count_date")
    .eq("id", userId)
    .single();

  const today = todayStr();
  const used = data?.scan_count_date === today ? data?.scans_used_today || 0 : 0;
  return { used, limit: plan.scansPerDay, plan };
}

// Checks the live count, blocks if at/over limit, otherwise increments
// and returns the new count so the UI can update immediately.
export async function checkAndConsumeScan(userId, planKey) {
  const status = await getLiveScanStatus(userId, planKey);
  if (status.limit === Infinity) return { allowed: true, used: 0, limit: Infinity };

  if (status.used >= status.limit) {
    return {
      allowed: false,
      reason: `You've used all ${status.limit} free scans today. Upgrade your plan for unlimited scans.`,
      used: status.used,
      limit: status.limit,
    };
  }

  const newCount = status.used + 1;
  const { error } = await supabase
    .from("subscribers")
    .update({ scans_used_today: newCount, scan_count_date: todayStr() })
    .eq("id", userId);

  if (error) {
    console.error("scan counter update failed:", error.message);
  }

  return { allowed: true, used: newCount, limit: status.limit };
}

// Filters the full pair list down to what this plan allows.
export function filterPairsForPlan(allPairs, planKey) {
  const plan = getPlanConfig(planKey);
  if (!plan.pairRestricted) return allPairs;

  const allowedSymbols = new Set([...FREE_FOREX_PAIRS, ...FREE_CRYPTO_PAIRS, ...FREE_COMMODITY_PAIRS]);
  return allPairs.filter((p) => allowedSymbols.has(p.symbol));
}
