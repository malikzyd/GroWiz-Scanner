// api/admin/list.js
import { createClient } from "@supabase/supabase-js";

// Service role key: full access, bypasses RLS. NEVER exposed to the
// browser — only used here, server-side. Set in Vercel env vars.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { password } = req.body || {};
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "wrong password" });
  }

  const { data: pending, error: pendingErr } = await supabaseAdmin
    .from("payment_verifications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: proUsers, error: proErr } = await supabaseAdmin
    .from("subscribers")
    .select("email, plan, plan_status, plan_expires_at, payment_method")
    .neq("plan", "free")
    .order("plan_expires_at", { ascending: true });

  if (pendingErr || proErr) {
    return res.status(500).json({ error: (pendingErr || proErr).message });
  }

  return res.status(200).json({ pending, proUsers });
}
