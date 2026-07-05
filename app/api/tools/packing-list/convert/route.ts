import { NextResponse } from "next/server";
import { getUserFromAuthHeader } from "../../../../../lib/supabaseServer";
import { parsePackingListCsv } from "../../../../../lib/services/packingListParser";

interface AuthMetadata {
  role?: string;
}

/**
 * POST /api/tools/packing-list/convert
 *
 * Accepts a CSV packing list and returns parsed GRN-ready line items.
 * CSV only — all other formats return 400.
 *
 * Inputs (multipart/form-data):
 *   file         — the CSV file (required)
 *   supplier_name — optional; used to look up saved column-mapping rules
 *
 * Returns:
 *   {
 *     parsed:       ParsedGrnLine[],   — rows that passed validation
 *     review:       ReviewRow[],       — rows that failed validation (manual review needed)
 *     headers:      string[],          — CSV headers detected
 *     mapping_used: { [csvHeader]: canonicalField } | null
 *   }
 *
 * Auth: WAREHOUSE_MANAGER | ADMIN
 */
export async function POST(req: Request) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (user.user_metadata as AuthMetadata | null)?.role ?? "";
  if (!["WAREHOUSE_MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: Warehouse Manager or Admin only" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // Only accept CSV via multipart (file field) or raw text/csv body
  let csvText = "";
  let supplierName: string | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file field is required" }, { status: 400 });
      }

      // Enforce CSV only
      const fileName = file.name.toLowerCase();
      const mimeType = file.type.toLowerCase();
      const isTextCsv = mimeType === "text/csv" || mimeType === "application/csv";
      const hasCsvExtension = fileName.endsWith(".csv");

      if (!isTextCsv && !hasCsvExtension) {
        return NextResponse.json(
          {
            error:
              `Only CSV files are accepted (got "${file.name}"). ` +
              "Please export your packing list as a .csv file.",
          },
          { status: 400 },
        );
      }

      csvText = await file.text();
      supplierName = (form.get("supplier_name") as string | null) ?? undefined;
    } else if (contentType.includes("text/csv")) {
      csvText = await req.text();
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported content type. Send a multipart/form-data request with a 'file' field " +
            "containing a .csv file, or a text/csv body.",
        },
        { status: 400 },
      );
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Failed to read request: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 400 },
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  }

  try {
    const result = await parsePackingListCsv(csvText, supplierName);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Could not determine") || message.includes("empty") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
