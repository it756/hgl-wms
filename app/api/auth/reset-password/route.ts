import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

/**
 * POST /api/auth/reset-password
 * Triggers a password reset email via Supabase Auth.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/update-password`,
    },
  });

  if (error) {
    // Do not leak whether email exists
    console.error("[reset-password] Error generating reset link:", error.message);
  }

  // Always return success to prevent user enumeration
  return NextResponse.json({ message: "If this email is registered, a reset link has been sent." });
}
