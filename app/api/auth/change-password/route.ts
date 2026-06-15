import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const PW_POLICY = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?])(.{8,})$/;

/**
 * POST /api/auth/change-password
 * Body: { current_password: string; new_password: string }
 *
 * Verifies the current password by re-authenticating against Supabase Auth,
 * then uses the admin client to set the new password.
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.email) {
    return NextResponse.json({ error: "User account has no email address" }, { status: 422 });
  }

  const body = await req.json();
  const { current_password, new_password } = body as {
    current_password?: string;
    new_password?: string;
  };

  if (!current_password || !new_password) {
    return NextResponse.json(
      { error: "current_password and new_password are required" },
      { status: 400 },
    );
  }

  if (!PW_POLICY.test(new_password)) {
    return NextResponse.json(
      {
        error:
          "New password must be at least 8 characters and contain at least one number and one special character",
      },
      { status: 400 },
    );
  }

  if (current_password === new_password) {
    return NextResponse.json(
      { error: "New password must be different from the current password" },
      { status: 400 },
    );
  }

  // Verify current password by signing in with a short-lived anon client
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  });

  if (signInError) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // Update password via admin client
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: new_password,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
