import { createClient, type User } from "@supabase/supabase-js";
import { evaluateLicenseAccess, type LicenseAccessDenial } from "./licensePolicy";

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

export interface AuthProfile {
  full_name: string | null;
  role: string;
  sbu_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  licensed: boolean;
  license_type: string | null;
  license_issued_at: string | null;
  license_expires_at: string | null;
}

export type AppAuthResult =
  | { ok: true; user: User; profile: AuthProfile }
  | { ok: false; reason: "UNAUTHENTICATED" | LicenseAccessDenial; message?: string };

const AUTH_PROFILE_SELECT =
  "full_name, role, sbu_id, unit_id, is_active, licensed, license_type, license_issued_at, license_expires_at";

function isInvalidAuthTokenError(error: { message?: string }): boolean {
  const msg = error.message || "";
  return (
    msg.includes("token is expired") ||
    msg.includes("invalid JWT") ||
    msg.includes("unable to parse or verify signature") ||
    msg.includes("invalid claims")
  );
}

export async function getAppAuthFromToken(token: string): Promise<AppAuthResult> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) {
    if (isInvalidAuthTokenError(error)) return { ok: false, reason: "UNAUTHENTICATED" };
    throw error;
  }

  if (!data.user) return { ok: false, reason: "UNAUTHENTICATED" };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(AUTH_PROFILE_SELECT)
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const access = evaluateLicenseAccess(profile as AuthProfile | null);
  if (!access.allowed) return { ok: false, reason: access.reason };

  const authProfile = profile as AuthProfile;
  return {
    ok: true,
    profile: authProfile,
    user: {
      ...data.user,
      user_metadata: {
        ...(data.user.user_metadata ?? {}),
        full_name: authProfile.full_name,
        role: authProfile.role,
        sbu_id: authProfile.sbu_id,
        unit_id: authProfile.unit_id,
        is_active: authProfile.is_active,
        licensed: authProfile.licensed,
        license_type: authProfile.license_type,
        license_issued_at: authProfile.license_issued_at,
        license_expires_at: authProfile.license_expires_at,
      },
    },
  };
}

export async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.split(" ")[1];
  if (!token) return null;

  const result = await getAppAuthFromToken(token);
  if (!result.ok) return null;
  return result.user;
}
