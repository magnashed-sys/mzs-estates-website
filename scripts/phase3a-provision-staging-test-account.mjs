// Create ONE synthetic, password-login account in MZS Staging via Supabase Auth.
// This file never runs in CI or Vercel. Invoke it locally, with credentials
// obtained from a secret manager. Do not commit, log or paste secrets.
// Requires npm install (uses the app's existing @supabase/supabase-js).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const STAGING_URL = "https://senonkpxdtlhyhrubicg.supabase.co";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.PHASE3A_TEST_PASSWORD;
const label = (process.env.PHASE3A_TEST_LABEL || "Capital").trim();

function fail(message) {
  console.error(`Phase 3A Staging setup refused: ${message}`);
  process.exitCode = 1;
}

if (url !== STAGING_URL) {
  fail("SUPABASE_URL must be the exact dedicated MZS Staging project.");
} else if (!key || key.length < 32) {
  fail("A Staging-only service credential must be supplied privately.");
} else if (!password || password.length < 16) {
  fail("PHASE3A_TEST_PASSWORD must contain at least 16 characters.");
} else if (!["Capital", "Estates", "Client"].includes(label)) {
  fail("PHASE3A_TEST_LABEL must be Capital, Estates or Client.");
} else {
  const id = randomUUID();
  const email = `phase3a-test-${id}@example.invalid`;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let createdId = null;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { mzs_phase3a_test: true },
      user_metadata: { full_name: `Phase 3A Test ${label}` },
    });
    if (error || !data?.user) {
      throw new Error("Supabase Staging Auth rejected the test identity.");
    }
    createdId = data.user.id;
    // Supabase creates the profile inactive by default. Activate ONLY the
    // newly created, administrator-marked synthetic identity in Staging.
    const { data: active, error: profileError } = await admin.from("profiles")
      .update({ is_active: true })
      .eq("id", createdId)
      .eq("role", "client")
      .eq("is_active", false)
      .select("id").single();
    if (profileError || !active) {
      throw new Error("Could not activate the new synthetic Staging profile.");
    }
    const { data: check, error: checkError } = await admin.auth.admin.getUserById(createdId);
    if (checkError || check?.user?.app_metadata?.mzs_phase3a_test !== true ||
      check.user.email !== email) {
      throw new Error("Synthetic Staging app_metadata verification failed.");
    }
    console.log(JSON.stringify({
      created: true,
      project: "MZS Staging",
      user_id: createdId,
      email,
      label,
      note: "Password remains in your local secret input. No department scope granted."
    }, null, 2));
  } catch (error) {
    // No unapproved test identity should survive an incomplete setup.
    if (createdId) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(createdId);
      if (cleanupError) console.error("Manual Staging test user cleanup required:", createdId);
    }
    fail(error instanceof Error ? error.message : "Unexpected Staging Auth failure.");
  }
}
