import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.split(" ")[1];
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) {
    const msg = error.message || "";
    // Treat expired / invalid JWT as unauthenticated rather than a server error
    if (
      msg.includes("token is expired") ||
      msg.includes("invalid JWT") ||
      msg.includes("unable to parse or verify signature") ||
      msg.includes("invalid claims")
    ) {
      return null;
    }
    throw error;
  }
  return data.user;
}
