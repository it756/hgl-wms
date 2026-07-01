import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import { validateToken } from "../../../../../lib/services/externalTokenService";

/**
 * GET /api/external/procurement/[token]
 * Public route — no WMS login required.
 * Validates the procurement token and returns a redacted view of the purchase request.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const result = await validateToken(params.token, { ip, userAgent });

  if (!result.valid) {
    const messages: Record<string, string> = {
      NOT_FOUND: "This link is invalid or does not exist.",
      EXPIRED: "This link has expired. Please contact the requesting team to send a new one.",
      USED: "This link has already been used. No further action is required.",
      REVOKED: "This link has been revoked. Please contact the requesting team.",
    };
    return NextResponse.json(
      { error: messages[result.reason] ?? "Invalid link." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { token } = result;

  if (token.entity_type !== "purchase_request") {
    return NextResponse.json(
      { error: "Invalid token type." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("purchase_requests")
    .select(
      `id, reference_number, status, supplier_name, supplier_email, notes, estimated_total, created_at,
       sbus(id, name, code),
       purchase_request_line_items(id, product_name, sku, quantity_requested, unit_of_measure, unit_cost, notes)`,
    )
    .eq("id", token.entity_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Purchase request not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      purchaseRequest: data,
      token: {
        allowedActions: token.allowed_actions,
        expiresAt: token.expires_at,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
