import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createServerClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env vars missing");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}
