// src/lib/scanGate.js
import { supabase } from "./supabaseClient";
import { getPlanConfig, FREE_FOREX_PAIRS, FREE_CRYPTO_PAIRS, FREE_COMMODITY_PAIRS } from "./plans";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Checks whether this user can run a scan right now, and if so, records
// the usage. Returns { allowed, reason, scansRemaining }.
export async function checkAndConsumeScan(userId, profile) {
  const plan = getPlanConfig(profile?.plan);
  if (plan.scansPerDay === Infinity) {
    return { allowed: true, scansRemaining: Infinity };
  }

  const today = todayStr();
  const isNewDay = profile?.scan_count_date !== today;
  const currentCount = isNewDay ? 0 : profile?.scans_used_today || 0;

  if (currentCount >= plan.scansPerDay) {
    return { allowed: false, reason: `Free plan limit reached (${plan.scansPerDay} scans/day). Upgrade for unlimited scans.`, scansRemaining: 0 };
  }

  const newCount = currentCount + 1;
  const { error } = await supabase
    .from("subscribers")
    .update({ scans_used_today: newCount, scan_count_date: today })
    .eq("id", userId);

  if (error) {
    // Fail open on the write — don't block a scan just because the
    // counter update failed, but log for your own visibility.
    console.error("scan counter update failed:", error.message);
  }

  return { allowed: true, scansRemaining: plan.scansPerDay - newCount };
}

// Filters the full pair list down to what this plan allows.
export function filterPairsForPlan(allPairs, planKey) {
  const plan = getPlanConfig(planKey);
  if (!plan.pairRestricted) return allPairs;

  const allowedSymbols = new Set([...FREE_FOREX_PAIRS, ...FREE_CRYPTO_PAIRS, ...FREE_COMMODITY_PAIRS]);
  return allPairs.filter((p) => allowedSymbols.has(p.symbol));
}
