// =============================================================================
// GhostFix — Supabase Server Client
//
// Use this ONLY in Server Components, API Routes, and Server Actions.
// It reads env vars at request time — never exposes the service_role key
// to the browser.
// =============================================================================

import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client that uses the service_role key.
 * This bypasses Row Level Security, which is what we need inside
 * trusted API routes (the server is the trusted actor, not the end-user).
 *
 * ⚠️  NEVER import this into any file that gets bundled for the browser.
 *
 * Note: We omit the Database generic here to avoid fighting the GenericSchema
 * constraint during development. All queries are explicitly typed at the call
 * site using the types defined in ./types.ts via explicit `as` casts.
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables.\n" +
        "Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Disable the auto-refresh token flow — we don't need sessions
      // in server-to-server calls.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
