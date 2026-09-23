// api/admin/verify.js
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_DURATIONS_DAYS = {
  pro: 30,
  premium: 30,
  founding: null, // lifetime — never expires
};

const FOUNDING_MEMBER_CAP = 15;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { password, verificationId, action, overridePlan } = req.body || {};
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "wrong password" });
  }
  if (!verificationId || !["verify", "reject"].includes(action)) {
    return res.status(400).json({ error: "verificationId and action ('verify'|'reject') required" });
  }

  const { data: record, error: fetchErr } = await supabaseAdmin
    .from("payment_verifications")
    .select("*")
    .eq("id", verificationId)
    .single();

  if (fetchErr || !record) {
    return res.status(404).json({ error: "verification not found" });
  }

  if (action === "reject") {
    await supabaseAdmin
      .from("payment_verifications")
      .update({ status: "rejected" })
      .eq("id", verificationId);
    return res.status(200).json({ ok: true, status: "rejected" });
  }

  // action === "verify" — the admin's dropdown selection is the final
  // authority on which plan gets granted, falling back to whatever the
  // user originally submitted if none was sent.
  const grantedPlan = overridePlan || record.plan;

  if (grantedPlan === "founding") {
    const { count, error: countErr } = await supabaseAdmin
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("plan", "founding");
    if (countErr) {
      return res.status(500).json({ error: `founding count check failed: ${countErr.message}` });
    }
    if ((count || 0) >= FOUNDING_MEMBER_CAP) {
      return res.status(400).json({ error: `Founding member cap (${FOUNDING_MEMBER_CAP}) already reached — verify as 'pro' or 'premium' instead.` });
    }
  }

  const durationDays = PLAN_DURATIONS_DAYS[grantedPlan];
  const expiresAt = durationDays == null ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const planKey = grantedPlan === "founding" ? "premium" : grantedPlan; // founding members get premium-level access, tracked separately via payment_method

  const { error: subErr } = await supabaseAdmin
    .from("subscribers")
    .update({
      plan: planKey,
      plan_status: "active",
      plan_expires_at: expiresAt,
      payment_method: grantedPlan === "founding" ? "binance-founding" : "binance",
    })
    .eq("email", record.email);

  if (subErr) {
    return res.status(500).json({ error: `subscriber update failed: ${subErr.message}` });
  }

  await supabaseAdmin
    .from("payment_verifications")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", verificationId);

  return res.status(200).json({ ok: true, status: "verified", expiresAt });
}
