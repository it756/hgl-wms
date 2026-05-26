import { NextResponse } from "next/server";
import { supabaseAdmin, getUserFromAuthHeader } from "../../../lib/supabaseServer";

const BUCKET = "hgl-wms";

const VALID_TYPES = [
  "transfer_request",
  "issuance",
  "grn",
  "supplier_grn",
  "return_request",
] as const;

type TransactionType = (typeof VALID_TYPES)[number];

function ext(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "pdf";
}

// ─── POST /api/documents ─────────────────────────────────────────────────────
// Body: multipart/form-data
//   file             File   (required)
//   transaction_type string (required)
//   transaction_id   string (required, UUID)
//   document_label   string (optional)

export async function POST(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const transactionType = formData.get("transaction_type") as string | null;
    const transactionId = formData.get("transaction_id") as string | null;
    const documentLabel = (formData.get("document_label") as string | null) || null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!transactionType || !(VALID_TYPES as readonly string[]).includes(transactionType)) {
      return NextResponse.json({ error: "Invalid transaction_type" }, { status: 400 });
    }
    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id is required" }, { status: 400 });
    }

    const allowedMime = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedMime.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG and PNG files are accepted" },
        { status: 415 },
      );
    }

    const storagePath = `${transactionType}/${transactionId}/${crypto.randomUUID()}.${ext(file.type)}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }

    const { data: doc, error: dbError } = await supabaseAdmin
      .from("transaction_documents")
      .insert({
        transaction_type: transactionType as TransactionType,
        transaction_id: transactionId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        document_label: documentLabel,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Attempt to remove the orphaned storage object; capture the result so
      // a failed cleanup is surfaced in logs and the response payload.
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);
      console.error("DB insert error:", dbError);
      if (cleanupError) {
        console.error("Storage cleanup error (orphaned file may remain):", cleanupError);
      }
      return NextResponse.json(
        {
          error: "Failed to save document metadata",
          ...(cleanupError && { cleanup_error: cleanupError.message }),
        },
        { status: 500 },
      );
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/documents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── GET /api/documents?transaction_type=X&transaction_id=Y ──────────────────

export async function GET(req: Request) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const transactionType = searchParams.get("transaction_type");
    const transactionId = searchParams.get("transaction_id");

    if (!transactionType || !(VALID_TYPES as readonly string[]).includes(transactionType)) {
      return NextResponse.json({ error: "Invalid transaction_type" }, { status: 400 });
    }
    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id is required" }, { status: 400 });
    }

    const { data: docs, error } = await supabaseAdmin
      .from("transaction_documents")
      .select(
        "id, file_name, file_size, mime_type, document_label, storage_path, uploaded_by, created_at",
      )
      .eq("transaction_type", transactionType)
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Generate short-lived signed URLs for each document
    const docsWithUrls = await Promise.all(
      (docs ?? []).map(async (doc) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 3600); // 1-hour expiry
        return {
          ...doc,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return NextResponse.json(docsWithUrls);
  } catch (err: unknown) {
    console.error("GET /api/documents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
