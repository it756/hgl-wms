import { NextResponse } from "next/server";
import { validateToken } from "../../../../../../lib/services/externalTokenService";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

const BUCKET = "hgl-wms";
const TRANSACTION_TYPE = "purchase_request";
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function ext(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "pdf";
}

async function validateProcurementToken(rawToken: string, req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const result = await validateToken(rawToken, { ip, userAgent });

  if (!result.valid) {
    const messages: Record<string, string> = {
      NOT_FOUND: "This link is invalid or does not exist.",
      EXPIRED: "This link has expired. Please contact the requesting team to send a new one.",
      USED: "This link has already been used. No further action is required.",
      REVOKED: "This link has been revoked. Please contact the requesting team.",
    };
    return { error: NextResponse.json({ error: messages[result.reason] }, { status: 410 }) };
  }

  if (result.token.entity_type !== "purchase_request") {
    return { error: NextResponse.json({ error: "Invalid token type." }, { status: 400 }) };
  }

  if (!result.token.allowed_actions.includes("UPLOAD")) {
    return {
      error: NextResponse.json(
        { error: "Document upload is not permitted for this token." },
        { status: 403 },
      ),
    };
  }

  return { token: result.token };
}

async function withSignedUrl(doc: {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  document_label: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}) {
  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 3600);

  return {
    id: doc.id,
    file_name: doc.file_name,
    file_size: doc.file_size,
    mime_type: doc.mime_type,
    document_label: doc.document_label,
    uploaded_by: doc.uploaded_by,
    created_at: doc.created_at,
    url: signed?.signedUrl ?? null,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const validation = await validateProcurementToken(rawToken, req);
  if (validation.error) return validation.error;

  const { data: docs, error } = await supabaseAdmin
    .from("transaction_documents")
    .select(
      "id, file_name, file_size, mime_type, document_label, storage_path, uploaded_by, created_at",
    )
    .eq("transaction_type", TRANSACTION_TYPE)
    .eq("transaction_id", validation.token.entity_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET /api/external/procurement/[token]/documents error:", error);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }

  return NextResponse.json(await Promise.all((docs ?? []).map(withSignedUrl)));
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const validation = await validateProcurementToken(rawToken, req);
  if (validation.error) return validation.error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentLabel = (formData.get("document_label") as string | null) || null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, JPEG and PNG files are accepted" },
      { status: 415 },
    );
  }

  const storagePath = `${TRANSACTION_TYPE}/${validation.token.entity_id}/${crypto.randomUUID()}.${ext(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("External procurement storage upload error:", uploadError);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  const { data: doc, error: dbError } = await supabaseAdmin
    .from("transaction_documents")
    .insert({
      transaction_type: TRANSACTION_TYPE,
      transaction_id: validation.token.entity_id,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      document_label: documentLabel,
      uploaded_by: null,
    })
    .select(
      "id, file_name, file_size, mime_type, document_label, storage_path, uploaded_by, created_at",
    )
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    console.error("External procurement document metadata error:", dbError);
    return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 });
  }

  return NextResponse.json(await withSignedUrl(doc), { status: 201 });
}