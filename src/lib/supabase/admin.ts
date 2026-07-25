import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Nur in serverseitigem Code verwenden (Route Handler, Server Components) --
// nutzt den Service-Role-Key und umgeht RLS vollstaendig.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
