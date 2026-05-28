import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client — uses the service role key which bypasses RLS.
 * NEVER import this in client components or pages marked "use client".
 * Only used inside API routes (app/api/**).
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
