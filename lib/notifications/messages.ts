import { supabaseAdmin } from "../supabaseServer";

type Nullable<T> = T | null | undefined;

interface LabelledEntity {
  name?: Nullable<string>;
  code?: Nullable<string>;
}

export interface ProductLineSummary {
  name: Nullable<string>;
  sku?: Nullable<string>;
  quantity?: Nullable<number>;
  unit?: Nullable<string>;
  warehouseLocation?: Nullable<string>;
  /** Short annotation appended to the line, e.g. "issued 10, received 8" */
  varianceNote?: Nullable<string>;
}

export interface ProfileContact {
  name: string | null;
  email: string | null;
  role: string | null;
}

interface ProfileContactRow {
  full_name?: Nullable<string>;
  role?: Nullable<string>;
}

/** Acronyms that should stay fully uppercase when humanizing snake_case/SCREAMING_SNAKE labels. */
const LABEL_ACRONYMS = new Set(["bu", "sbu", "sbus", "grn", "grns", "sku", "id"]);

/**
 * Converts SCREAMING_SNAKE_CASE or snake_case identifiers (role names, notification
 * types, status codes) into a readable Title Case label, e.g.
 * "FINANCE_MANAGER" -> "Finance Manager", "transfer_request_submitted" -> "Transfer Request Submitted".
 */
export function humanizeLabel(value: Nullable<string>): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (LABEL_ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

interface ProductRow {
  name?: Nullable<string>;
  sku?: Nullable<string>;
  unit_of_measure?: Nullable<string>;
  warehouse_location?: Nullable<string>;
}

interface QuantityProductLineRow {
  requested_quantity?: Nullable<number>;
  quantity_received?: Nullable<number>;
  quantity_to_return?: Nullable<number>;
  products?: Nullable<ProductRow>;
}

interface TransferContextRow {
  reference_number?: Nullable<string>;
  raised_by?: Nullable<string>;
  estimated_value?: Nullable<number>;
  notes?: Nullable<string>;
  sbus?: Nullable<LabelledEntity>;
  sbu_units?: Nullable<LabelledEntity>;
  transfer_line_items?: QuantityProductLineRow[];
}

interface GrnLineItemRow {
  issued_quantity?: Nullable<number>;
  quantity_received?: Nullable<number>;
  products?: Nullable<ProductRow>;
}

interface GrnContextRow {
  condition_notes?: Nullable<string>;
  received_by?: Nullable<string>;
  transfer_requests?: Nullable<{
    reference_number?: Nullable<string>;
    sbus?: Nullable<LabelledEntity>;
    sbu_units?: Nullable<LabelledEntity>;
  }>;
  grn_line_items?: GrnLineItemRow[];
}

interface SupplierGrnContextRow {
  reference_number?: Nullable<string>;
  supplier_name?: Nullable<string>;
  supplier_invoice_reference?: Nullable<string>;
  invoice_amount?: Nullable<number>;
  received_by?: Nullable<string>;
  sbus?: Nullable<LabelledEntity>;
  supplier_grn_line_items?: QuantityProductLineRow[];
}

interface ReturnContextRow {
  reference_number?: Nullable<string>;
  reason?: Nullable<string>;
  notes?: Nullable<string>;
  raised_by?: Nullable<string>;
  approved_by?: Nullable<string>;
  received_by?: Nullable<string>;
  sbus?: Nullable<LabelledEntity>;
  original_transfer_request?: Nullable<{ reference_number?: Nullable<string> }>;
  return_line_items?: QuantityProductLineRow[];
}

interface IntraTransferContextRow {
  reference_number?: Nullable<string>;
  quantity?: Nullable<number>;
  transferred_by?: Nullable<string>;
  notes?: Nullable<string>;
  products?: Nullable<ProductRow>;
  to_sbu?: Nullable<LabelledEntity>;
  from_sbu?: Nullable<LabelledEntity>;
}

export interface DetailMessageInput {
  headline: string;
  reference?: Nullable<string>;
  actorLabel?: string;
  actorName?: Nullable<string>;
  requesterName?: Nullable<string>;
  approverName?: Nullable<string>;
  receiverName?: Nullable<string>;
  sbu?: Nullable<string>;
  unit?: Nullable<string>;
  location?: Nullable<string>;
  supplier?: Nullable<string>;
  invoiceReference?: Nullable<string>;
  invoiceAmount?: Nullable<number>;
  products?: ProductLineSummary[];
  notes?: Nullable<string>;
}

function isPresent(value: Nullable<string | number>): value is string | number {
  return value !== null && value !== undefined && `${value}`.trim() !== "";
}

export function formatEntityLabel(entity: Nullable<LabelledEntity>): string | null {
  if (!entity) return null;
  if (isPresent(entity.name) && isPresent(entity.code)) return `${entity.name} (${entity.code})`;
  if (isPresent(entity.name)) return `${entity.name}`;
  if (isPresent(entity.code)) return `${entity.code}`;
  return null;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatProducts(products: ProductLineSummary[]): string | null {
  const labels = products
    .filter((product) => isPresent(product.name))
    .slice(0, 4)
    .map((product) => {
      const quantity = isPresent(product.quantity)
        ? `${product.quantity}${product.unit ? ` ${product.unit}` : ""}`
        : null;
      const sku = product.sku ? ` (${product.sku})` : "";
      const location = product.warehouseLocation ? ` @ ${product.warehouseLocation}` : "";
      const variance = product.varianceNote ? ` [${product.varianceNote}]` : "";
      return [quantity, `${product.name}${sku}${location}${variance}`].filter(Boolean).join(" x ");
    });

  if (labels.length === 0) return null;
  const remaining = products.length - labels.length;
  return remaining > 0 ? `${labels.join("; ")}; +${remaining} more` : labels.join("; ");
}

export function buildDetailMessage(input: DetailMessageInput): string {
  const lines = [input.headline];
  const detailPairs = [
    ["Reference", input.reference],
    [input.actorLabel ?? "Action by", input.actorName],
    ["Requester", input.requesterName],
    ["Approver", input.approverName],
    ["Receiver", input.receiverName],
    ["SBU", input.sbu],
    ["Unit", input.unit],
    ["Location", input.location],
    ["Supplier", input.supplier],
    ["Invoice", input.invoiceReference],
    ["Invoice amount", isPresent(input.invoiceAmount) ? formatMoney(Number(input.invoiceAmount)) : null],
    ["Products", input.products ? formatProducts(input.products) : null],
    ["Notes", input.notes],
  ];

  for (const [label, value] of detailPairs) {
    if (isPresent(value)) lines.push(`${label}: ${value}`);
  }

  return lines.join("\n");
}

/**
 * Resolves a user's display name, email, and role in one shot so notification
 * emails can show a fully identifiable, human-readable party (e.g.
 * "Jane Doe (jane@company.com) — BU Manager") instead of a bare name or ID.
 */
export async function getProfileContact(userId: Nullable<string>): Promise<ProfileContact | null> {
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  const profileRow = profile as ProfileContactRow | null;

  let email: string | null = null;
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = authUser.user?.email ?? null;
  } catch {
    email = null;
  }

  return {
    name: isPresent(profileRow?.full_name) ? (profileRow!.full_name as string) : null,
    email,
    role: isPresent(profileRow?.role) ? (profileRow!.role as string) : null,
  };
}

/**
 * Formats a resolved contact as a single readable string, e.g.
 * "Jane Doe (jane@company.com) — BU Manager". Degrades gracefully when some
 * fields are missing (e.g. external actors with only an email).
 */
export function formatContact(contact: Nullable<ProfileContact>): string | null {
  if (!contact) return null;
  const roleLabel = isPresent(contact.role) ? humanizeLabel(contact.role) : null;
  const hasName = isPresent(contact.name);
  const hasEmail = isPresent(contact.email);

  let label: string;
  if (hasName && hasEmail) {
    label = `${contact.name} (${contact.email})`;
  } else if (hasName) {
    label = contact.name as string;
  } else if (hasEmail) {
    label = contact.email as string;
  } else {
    return roleLabel;
  }

  return roleLabel ? `${label} — ${roleLabel}` : label;
}

export async function buildTransferNotificationMessage(opts: {
  transferId: string;
  headline: string;
  actorId?: Nullable<string>;
  actorLabel?: string;
  notes?: Nullable<string>;
}): Promise<string> {
  const { data: transfer } = await supabaseAdmin
    .from("transfer_requests")
    .select(
      `reference_number, raised_by, estimated_value, notes,
       sbus ( name, code ),
       sbu_units ( name, code ),
       transfer_line_items ( requested_quantity, products ( name, sku, unit_of_measure, warehouse_location ) )`,
    )
    .eq("id", opts.transferId)
    .maybeSingle();

  const row = transfer as TransferContextRow | null;
  return buildDetailMessage({
    headline: opts.headline,
    reference: row?.reference_number,
    actorLabel: opts.actorLabel,
    actorName: formatContact(await getProfileContact(opts.actorId)),
    requesterName: formatContact(await getProfileContact(row?.raised_by)),
    sbu: formatEntityLabel(row?.sbus),
    unit: formatEntityLabel(row?.sbu_units),
    invoiceAmount: row?.estimated_value,
    products: (row?.transfer_line_items ?? []).map((line) => ({
      name: line.products?.name,
      sku: line.products?.sku,
      quantity: line.requested_quantity,
      unit: line.products?.unit_of_measure,
      warehouseLocation: line.products?.warehouse_location,
    })),
    notes: opts.notes ?? row?.notes,
  });
}

export async function buildSupplierGrnNotificationMessage(opts: {
  grnId: string;
  headline: string;
  actorId?: Nullable<string>;
  actorLabel?: string;
  notes?: Nullable<string>;
}): Promise<string> {
  const { data: grn } = await supabaseAdmin
    .from("supplier_grns")
    .select(
      `reference_number, supplier_name, supplier_invoice_reference, invoice_amount, received_by,
       sbus ( name, code ),
       supplier_grn_line_items ( quantity_received, products ( name, sku, unit_of_measure, warehouse_location ) )`,
    )
    .eq("id", opts.grnId)
    .maybeSingle();

  const row = grn as SupplierGrnContextRow | null;
  return buildDetailMessage({
    headline: opts.headline,
    reference: row?.reference_number,
    actorLabel: opts.actorLabel,
    actorName: formatContact(await getProfileContact(opts.actorId)),
    receiverName: formatContact(await getProfileContact(row?.received_by)),
    sbu: formatEntityLabel(row?.sbus),
    supplier: row?.supplier_name,
    invoiceReference: row?.supplier_invoice_reference,
    invoiceAmount: row?.invoice_amount,
    products: (row?.supplier_grn_line_items ?? []).map((line) => ({
      name: line.products?.name,
      sku: line.products?.sku,
      quantity: line.quantity_received,
      unit: line.products?.unit_of_measure,
      warehouseLocation: line.products?.warehouse_location,
    })),
    notes: opts.notes,
  });
}

export async function buildReturnNotificationMessage(opts: {
  returnId: string;
  headline: string;
  actorId?: Nullable<string>;
  actorLabel?: string;
  notes?: Nullable<string>;
}): Promise<string> {
  const { data: returnRequest } = await supabaseAdmin
    .from("return_requests")
    .select(
      `reference_number, reason, notes, raised_by, approved_by, received_by,
       sbus ( name, code ),
       original_transfer_request:transfer_requests!return_requests_original_transfer_request_id_fkey ( reference_number ),
       return_line_items ( quantity_to_return, quantity_received, products ( name, sku, unit_of_measure, warehouse_location ) )`,
    )
    .eq("id", opts.returnId)
    .maybeSingle();

  const row = returnRequest as ReturnContextRow | null;
  return buildDetailMessage({
    headline: opts.headline,
    reference: row?.reference_number,
    actorLabel: opts.actorLabel,
    actorName: formatContact(await getProfileContact(opts.actorId)),
    requesterName: formatContact(await getProfileContact(row?.raised_by)),
    approverName: formatContact(await getProfileContact(row?.approved_by)),
    receiverName: formatContact(await getProfileContact(row?.received_by)),
    sbu: formatEntityLabel(row?.sbus),
    location: row?.original_transfer_request?.reference_number
      ? `Original transfer ${row.original_transfer_request.reference_number}`
      : null,
    products: (row?.return_line_items ?? []).map((line) => ({
      name: line.products?.name,
      sku: line.products?.sku,
      quantity: line.quantity_received ?? line.quantity_to_return,
      unit: line.products?.unit_of_measure,
      warehouseLocation: line.products?.warehouse_location,
    })),
    notes: opts.notes ?? row?.notes ?? row?.reason,
  });
}

export async function buildIntraTransferNotificationMessage(opts: {
  transferId: string;
  headline: string;
  actorId?: Nullable<string>;
  actorLabel?: string;
  notes?: Nullable<string>;
}): Promise<string> {
  const { data: transfer } = await supabaseAdmin
    .from("intra_warehouse_transfers")
    .select(
      `reference_number, quantity, transferred_by, notes,
       products ( name, sku, unit_of_measure, warehouse_location ),
       to_sbu:sbus!intra_warehouse_transfers_to_sbu_id_fkey ( name, code ),
       from_sbu:sbus!intra_warehouse_transfers_from_sbu_id_fkey ( name, code )`,
    )
    .eq("id", opts.transferId)
    .maybeSingle();

  const row = transfer as IntraTransferContextRow | null;
  const fromLabel = formatEntityLabel(row?.from_sbu) ?? "Central warehouse";
  const toLabel = formatEntityLabel(row?.to_sbu);
  return buildDetailMessage({
    headline: opts.headline,
    reference: row?.reference_number,
    actorLabel: opts.actorLabel,
    actorName: formatContact(await getProfileContact(opts.actorId)),
    requesterName: formatContact(await getProfileContact(row?.transferred_by)),
    sbu: toLabel,
    location: toLabel ? `${fromLabel} to ${toLabel}` : fromLabel,
    products: row?.products
      ? [
          {
            name: row.products.name,
            sku: row.products.sku,
            quantity: row.quantity,
            unit: row.products.unit_of_measure,
            warehouseLocation: row.products.warehouse_location,
          },
        ]
      : [],
    notes: opts.notes ?? row?.notes,
  });
}

export async function buildGrnNotificationMessage(opts: {
  grnId: string;
  headline: string;
  actorId?: Nullable<string>;
  actorLabel?: string;
  notes?: Nullable<string>;
}): Promise<string> {
  const { data: grn } = await supabaseAdmin
    .from("grns")
    .select(
      `condition_notes, received_by,
       transfer_requests ( reference_number, sbus ( name, code ), sbu_units ( name, code ) ),
       grn_line_items ( issued_quantity, quantity_received, products ( name, sku, unit_of_measure, warehouse_location ) )`,
    )
    .eq("id", opts.grnId)
    .maybeSingle();

  const row = grn as GrnContextRow | null;
  const transfer = row?.transfer_requests;
  return buildDetailMessage({
    headline: opts.headline,
    reference: transfer?.reference_number,
    actorLabel: opts.actorLabel ?? "Received by",
    actorName: formatContact(await getProfileContact(opts.actorId ?? row?.received_by)),
    sbu: formatEntityLabel(transfer?.sbus),
    unit: formatEntityLabel(transfer?.sbu_units),
    products: (row?.grn_line_items ?? []).map((line) => {
      const issued = Number(line.issued_quantity ?? 0);
      const received = Number(line.quantity_received ?? 0);
      return {
        name: line.products?.name,
        sku: line.products?.sku,
        quantity: line.quantity_received,
        unit: line.products?.unit_of_measure,
        warehouseLocation: line.products?.warehouse_location,
        varianceNote: received !== issued ? `issued ${issued}, received ${received}` : null,
      };
    }),
    notes: opts.notes ?? row?.condition_notes,
  });
}

export interface ProductActionInput {
  headline: string;
  reference?: Nullable<string>;
  actorId?: Nullable<string>;
  actorLabel?: string;
  productName?: Nullable<string>;
  sku?: Nullable<string>;
  quantity?: Nullable<number>;
  unit?: Nullable<string>;
  location?: Nullable<string>;
  reason?: Nullable<string>;
  notes?: Nullable<string>;
}

/**
 * Lightweight message builder for ad hoc product/ledger actions (damage
 * write-off, expiry, recall, catalogue changes) that aren't tied to a
 * transfer/GRN/return row. Still surfaces the actor's full contact details
 * and the affected product/quantity for a detailed, readable email.
 */
export async function buildProductActionMessage(input: ProductActionInput): Promise<string> {
  return buildDetailMessage({
    headline: input.headline,
    reference: input.reference,
    actorLabel: input.actorLabel ?? "Action by",
    actorName: formatContact(await getProfileContact(input.actorId)),
    products: isPresent(input.productName)
      ? [
          {
            name: input.productName,
            sku: input.sku,
            quantity: input.quantity,
            unit: input.unit,
            warehouseLocation: input.location,
          },
        ]
      : undefined,
    notes: [input.reason, input.notes].filter(isPresent).join(" \u2014 ") || null,
  });
}