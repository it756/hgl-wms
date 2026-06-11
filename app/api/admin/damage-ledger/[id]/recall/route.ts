import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../../../lib/supabaseServer";
import { writeAuditLog } from "../../../../../../lib/services/auditService";
import { createNotification } from "../../../../../../lib/services/notificationService";

/**
 * POST /api/admin/damage-ledger/[id]/recall
 * Initiates a physical recall of damaged goods back to the warehouse for disposal/assessment.
 * Creates a damage_recall record linked to the damage_ledger entry.
 * NOTE: Stock is NOT restored — the goods are damaged. This is logistics tracking only.
 * Roles: ADMIN, WAREHOUSE_MANAGER.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: ledgerId } = await params;

  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as any)?.role ?? "";
  if (!["ADMIN", "WAREHOUSE_MANAGER"].includes(role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or Warehouse Manager only" },
      { status: 403 },
    );
  }

  // Validate damage ledger entry exists
  const { data: ledgerEntry, error: ledgerError } = await supabaseAdmin
    .from("damage_ledger")
    .select("id, product_id, quantity, transfer_reference, estimated_value, currency")
    .eq("id", ledgerId)
    .single();

  if (ledgerError || !ledgerEntry) {
    return NextResponse.json({ error: "Damage ledger entry not found" }, { status: 404 });
  }

  // Block duplicate recalls
  const { data: existingRecall } = await supabaseAdmin
    .from("damage_recalls")
    .select("id")
    .eq("damage_ledger_id", ledgerId)
    .maybeSingle();

  if (existingRecall) {
    return NextResponse.json(
      { error: "A recall has already been initiated for this damage entry" },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { notes } = body;

  // Create the recall record
  const { data: recall, error: recallError } = await supabaseAdmin
    .from("damage_recalls")
    .insert([
      {
        damage_ledger_id: ledgerId,
        initiated_by: user.id,
        status: "PENDING",
        notes: notes?.trim() || null,
      },
    ])
    .select("id")
    .single();

  if (recallError || !recall) {
    return NextResponse.json(
      { error: recallError?.message ?? "Failed to create recall" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    entity_type: "damage_recall",
    entity_id: (recall as any).id,
    action: "damage_recall_initiated",
    performed_by: user.id,
    new_value: {
      damage_ledger_id: ledgerId,
      product_id: (ledgerEntry as any).product_id,
      quantity: (ledgerEntry as any).quantity,
      transfer_reference: (ledgerEntry as any).transfer_reference,
    },
  });

  await createNotification({
    user_role: "WAREHOUSE_MANAGER",
    type: "damage_recall_initiated",
    message: `Damage recall initiated for ${(ledgerEntry as any).quantity} unit(s) from transfer ${(ledgerEntry as any).transfer_reference}`,
    related_entity_id: (recall as any).id,
  });

  return NextResponse.json({ id: (recall as any).id, status: "PENDING" }, { status: 201 });
}
