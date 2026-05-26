import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../../lib/supabaseServer";

const BUCKET = "wms-documents";

// Statuses in which a document may still be deleted by the uploader.
// Once a transaction moves past these stages it is considered finalised.
const DELETABLE_STATUSES: Record<string, string[]> = {
  transfer_request: ["PENDING", "PENDING_APPROVAL", "PENDING_BU_APPROVAL"],
  issuance: [], // issuances are final — no deletion allowed
  grn: [], // GRNs are final — no deletion allowed
  supplier_grn: ["AWAITING_FINANCE_APPROVAL"],
  return_request: ["PENDING_APPROVAL"],
};

async function getTransactionStatus(
  transactionType: string,
  transactionId: string,
): Promise<string | null> {
  const tableMap: Record<string, string> = {
    transfer_request: "transfer_requests",
    issuance: "issuances",
    grn: "grns",
    supplier_grn: "supplier_grns",
    return_request: "return_requests",
  };

  const table = tableMap[transactionType];
  if (!table) return null;

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("status")
    .eq("id", transactionId)
    .single();

  if (error || !data) return null;
  return (data as any)?.status ?? null;
}
// ─── DELETE /api/documents/[id] ──────────────────────────────────────────────

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Fetch the document record
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("transaction_documents")
      .select("id, storage_path, uploaded_by, transaction_type, transaction_id")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Only the original uploader may delete
    if ((doc as any).uploaded_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { transaction_type, transaction_id } = doc as any;

    // Check whether deletion is allowed for this transaction type
    const allowedStatuses = DELETABLE_STATUSES[transaction_type] ?? [];
    if (allowedStatuses.length === 0) {
      return NextResponse.json(
        { error: "Documents cannot be deleted for this transaction type" },
        { status: 403 },
      );
    }

    const status = await getTransactionStatus(transaction_type, transaction_id);
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Document cannot be deleted once the transaction has been finalised" },
        { status: 403 },
      );
    }

    // Remove from storage first; if it fails we leave the DB row intact (safer)
    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([(doc as any).storage_path]);

    if (storageError) {
      console.error("Storage remove error:", storageError);
      return NextResponse.json({ error: "Failed to delete file from storage" }, { status: 500 });
    }

    const { error: dbError } = await supabaseAdmin
      .from("transaction_documents")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("DB delete error:", dbError);
      return NextResponse.json({ error: "Failed to delete document record" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/documents/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
