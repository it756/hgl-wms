import { NextResponse } from "next/server";
import { validateToken, consumeToken } from "../../../../../../lib/services/externalTokenService";
import { applyProcurementAction } from "../../../../../../lib/services/purchaseRequestService";
import { sendProcurementConfirmationEmail } from "../../../../../../lib/email/templates/purchaseRequestTemplates";
import { writeAuditLog } from "../../../../../../lib/services/auditService";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

interface ActionBody {
  action?: string;
  notes?: string;
  document_url?: string;
}

const VALID_ACTIONS = ["APPROVE", "REJECT", "CHANGES_REQUESTED"] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

/**
 * POST /api/external/procurement/[token]/action
 * Public route — no WMS login required.
 * Procurement takes action on a purchase request via their secure token link.
 * Approve/Reject actions consume the token (single-use).
 * CHANGES_REQUESTED does NOT consume the token so procurement can resubmit if needed.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
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
      { status: 410 },
    );
  }

  const { token } = result;

  if (token.entity_type !== "purchase_request") {
    return NextResponse.json({ error: "Invalid token type." }, { status: 400 });
  }

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }
  const rawAction = body.action?.toUpperCase();

  if (!rawAction || !VALID_ACTIONS.includes(rawAction as ValidAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const action = rawAction as ValidAction;

  if (!token.allowed_actions.includes(action)) {
    return NextResponse.json(
      { error: "This action is not permitted for this token." },
      { status: 403 },
    );
  }

  // document_url requires explicit UPLOAD permission in the token
  if (body.document_url && !token.allowed_actions.includes("UPLOAD")) {
    return NextResponse.json(
      { error: "Document upload is not permitted for this token." },
      { status: 403 },
    );
  }

  try {
    const updated = await applyProcurementAction(token.entity_id, action, {
      notes: body.notes,
      documentUrl: body.document_url,
      actorEmail: token.actor_email,
    });

    // Approve and Reject consume the token (single-use); CHANGES_REQUESTED keeps it active
    // Best-effort: don't let token/audit failures roll back the already-committed state change
    if (action === "APPROVE" || action === "REJECT") {
      try {
        await consumeToken(token.id, { ip, userAgent });
      } catch (consumeErr) {
        console.error("[external/procurement/action] consumeToken failed", consumeErr);
      }
    }

    try {
      await writeAuditLog({
        entity_type: "purchase_request",
        entity_id: token.entity_id,
        action: `PROCUREMENT_${action}`,
        performed_by: undefined, // external actor — no auth.users id
        details: {
          actor_email: token.actor_email,
          actor_type: token.actor_type,
          notes: body.notes ?? null,
          document_url: body.document_url ?? null,
        },
        ip_address: ip,
      });
    } catch (auditErr) {
      console.error("[external/procurement/action] writeAuditLog failed", auditErr);
    }

    // Send confirmation email to procurement
    try {
      const { data: pr } = await supabaseAdmin
        .from("purchase_requests")
        .select("reference_number, procurement_email")
        .eq("id", token.entity_id)
        .single();

      if (pr) {
        const row = pr as { reference_number: string; procurement_email: string };
        await sendProcurementConfirmationEmail(row.procurement_email, row.reference_number, action);
      }
    } catch (emailErr) {
      console.error("[external/procurement/action] confirmation email failed", emailErr);
    }

    return NextResponse.json({
      success: true,
      status: updated.status,
      message:
        action === "APPROVE"
          ? "Purchase request approved. The requesting team has been notified."
          : action === "REJECT"
            ? "Purchase request rejected. The requesting team has been notified."
            : "Changes requested. The requesting team will review and resubmit.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not awaiting procurement") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
