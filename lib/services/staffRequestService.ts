import { supabaseAdmin } from "../supabaseServer";
import { writeAuditLog } from "./auditService";
import { createNotification } from "./notificationService";
import { sendEmail } from "../email";

const STAFF_REQUEST_REVIEW_EMAIL = "david.okuku@harvestgl.net";

export interface StaffRequestUserInfo {
  full_name: string;
  email: string;
  proposed_role: string;
  notes?: string;
}

export interface StaffRequest {
  id: string;
  requested_by_unit_id: string | null;
  requested_by_sbu_id: string | null;
  requested_user_info: StaffRequestUserInfo;
  requested_roles: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StaffRequestCreateInput {
  requested_user_info: StaffRequestUserInfo;
  requested_roles: string[];
  sbu_id: string;
  notes?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendStaffRequestReviewEmail(input: {
  staffRequest: StaffRequest;
  requesterId: string;
  sbuId: string;
}): Promise<void> {
  const { staffRequest, requesterId, sbuId } = input;

  const [
    { data: requesterProfile, error: requesterProfileError },
    { data: authUser, error: authUserError },
    { data: sbu, error: sbuError },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, role, sbu_id").eq("id", requesterId).single(),
    supabaseAdmin.auth.admin.getUserById(requesterId),
    supabaseAdmin.from("sbus").select("name, code").eq("id", sbuId).single(),
  ]);

  if (requesterProfileError) {
    console.warn("[staffRequestService] failed to load requester profile for email", requesterProfileError);
  }
  if (authUserError) {
    console.warn("[staffRequestService] failed to load requester auth user for email", authUserError);
  }
  if (sbuError) {
    console.warn("[staffRequestService] failed to load SBU for email", sbuError);
  }

  const requestedUser = staffRequest.requested_user_info;
  const requestedUserRows = Object.entries(requestedUser)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">${escapeHtml(key)}</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h2 style="margin:0 0 12px;">New BU Staff Creation Request</h2>
      <p>A BU manager submitted a request to create a user account.</p>

      <h3 style="margin:18px 0 8px;">Request Details</h3>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Request ID</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(staffRequest.id)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Submitted At</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(staffRequest.created_at)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Requester</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml((requesterProfile as any)?.full_name ?? authUser?.user?.email ?? requesterId)}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Requester Email</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(authUser?.user?.email ?? "")}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">SBU</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml((sbu as any)?.name ?? sbuId)} ${escapeHtml((sbu as any)?.code ? `(${(sbu as any).code})` : "")}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Requested Roles</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(staffRequest.requested_roles.join(", "))}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">Notes</td>
          <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(staffRequest.notes ?? "")}</td>
        </tr>
      </table>

      <h3 style="margin:18px 0 8px;">Requested User</h3>
      <table style="border-collapse:collapse;font-size:14px;">
        ${requestedUserRows}
      </table>
    </div>`;

  await sendEmail(
    STAFF_REQUEST_REVIEW_EMAIL,
    `New BU staff request: ${requestedUser.full_name} (${requestedUser.email})`.replace(/[\r\n]+/g, " "),
    html,
  );
}

// ─────────────────────────────────────────────
// Create a staff request (BU Manager)
// ─────────────────────────────────────────────
export async function createStaffRequest(
  input: StaffRequestCreateInput,
  createdBy: string,
): Promise<StaffRequest> {
  const { requested_user_info, requested_roles, sbu_id, notes } = input;

  if (!requested_user_info.full_name || !requested_user_info.email) {
    throw new Error("full_name and email are required in requested_user_info");
  }
  if (!requested_roles.length) {
    throw new Error("At least one requested role is required");
  }

  const VALID_ROLES = ["BU_MANAGER", "WAREHOUSE_MANAGER", "UNIT_STAFF", "FINANCE_MANAGER"];
  for (const r of requested_roles) {
    if (!VALID_ROLES.includes(r)) {
      throw new Error(`Invalid role: ${r}. Must be one of: ${VALID_ROLES.join(", ")}`);
    }
  }

  const { data: staffRequest, error } = await supabaseAdmin
    .from("staff_requests")
    .insert([
      {
        requested_by_sbu_id: sbu_id,
        requested_user_info,
        requested_roles,
        status: "PENDING",
        notes: notes ?? null,
        created_by: createdBy,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  try {
    await sendStaffRequestReviewEmail({
      staffRequest: staffRequest as StaffRequest,
      requesterId: createdBy,
      sbuId: sbu_id,
    });
  } catch (emailErr) {
    console.error("[staffRequestService] review email failed", emailErr);
  }

  // Notify admins of new pending request
  try {
    await createNotification({
      user_role: "ADMIN",
      type: "staff_request_pending",
      message: `New staff request from BU for ${requested_user_info.full_name} (${requested_user_info.email}) — role: ${requested_roles.join(", ")}`,
      related_entity_id: (staffRequest as StaffRequest).id,
      dispatchChannels: true,
    });
  } catch (notifErr) {
    console.error("[staffRequestService] admin notification failed", notifErr);
  }

  await writeAuditLog({
    entity_type: "staff_request",
    entity_id: (staffRequest as StaffRequest).id,
    action: "CREATED",
    performed_by: createdBy,
    new_value: { status: "PENDING", sbu_id, requested_roles },
  });

  return staffRequest as StaffRequest;
}

// ─────────────────────────────────────────────
// List staff requests (Admin)
// ─────────────────────────────────────────────
export async function listStaffRequests(opts?: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  sbu_id?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffRequest[]> {
  const limit = Math.min(opts?.limit ?? 50, 200);
  const offset = opts?.offset ?? 0;

  let query = supabaseAdmin
    .from("staff_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.sbu_id) query = query.eq("requested_by_sbu_id", opts.sbu_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StaffRequest[];
}

// ─────────────────────────────────────────────
// Approve a staff request (Admin)
// ─────────────────────────────────────────────
export async function approveStaffRequest(
  id: string,
  reviewedBy: string,
  notes?: string,
): Promise<StaffRequest> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("staff_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Staff request not found");

  const sr = existing as StaffRequest;
  if (sr.status !== "PENDING") {
    throw new Error(`Staff request is not pending. Current status: ${sr.status}`);
  }

  const reviewedAt = new Date().toISOString();

  // Conditional update to guard against concurrent decisions
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("staff_requests")
    .update({ status: "APPROVED", reviewed_by: reviewedBy, reviewed_at: reviewedAt, notes: notes ?? null, updated_at: reviewedAt })
    .eq("id", id)
    .eq("status", "PENDING")
    .select();

  if (updateError) throw updateError;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("Staff request was already reviewed by another admin");
  }

  // Notify the original requester (BU Manager)
  try {
    await createNotification({
      user_id: sr.created_by,
      type: "staff_request_approved",
      message: `Your staff request for ${sr.requested_user_info.full_name} has been approved. Admin will create the account.`,
      related_entity_id: id,
      dispatchChannels: true,
    });
  } catch (notifErr) {
    console.error("[staffRequestService] BU manager notification failed", notifErr);
  }

  await writeAuditLog({
    entity_type: "staff_request",
    entity_id: id,
    action: "APPROVED",
    performed_by: reviewedBy,
    previous_value: { status: "PENDING" },
    new_value: { status: "APPROVED", notes },
  });

  return updatedRows[0] as StaffRequest;
}

// ─────────────────────────────────────────────
// Reject a staff request (Admin)
// ─────────────────────────────────────────────
export async function rejectStaffRequest(
  id: string,
  reviewedBy: string,
  notes?: string,
): Promise<StaffRequest> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("staff_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("Staff request not found");

  const sr = existing as StaffRequest;
  if (sr.status !== "PENDING") {
    throw new Error(`Staff request is not pending. Current status: ${sr.status}`);
  }

  const reviewedAt = new Date().toISOString();

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("staff_requests")
    .update({ status: "REJECTED", reviewed_by: reviewedBy, reviewed_at: reviewedAt, notes: notes ?? null, updated_at: reviewedAt })
    .eq("id", id)
    .eq("status", "PENDING")
    .select();

  if (updateError) throw updateError;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("Staff request was already reviewed by another admin");
  }

  // Notify the original requester (BU Manager)
  try {
    await createNotification({
      user_id: sr.created_by,
      type: "staff_request_rejected",
      message: `Your staff request for ${sr.requested_user_info.full_name} was rejected. ${notes ? `Reason: ${notes}` : ""}`.trim(),
      related_entity_id: id,
      dispatchChannels: true,
    });
  } catch (notifErr) {
    console.error("[staffRequestService] BU manager notification failed", notifErr);
  }

  await writeAuditLog({
    entity_type: "staff_request",
    entity_id: id,
    action: "REJECTED",
    performed_by: reviewedBy,
    previous_value: { status: "PENDING" },
    new_value: { status: "REJECTED", notes },
  });

  return updatedRows[0] as StaffRequest;
}
