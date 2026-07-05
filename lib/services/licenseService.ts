import { supabaseAdmin } from "../supabaseServer";
import { writeAuditLog } from "./auditService";

export interface LicenseAssignInput {
  profile_id: string;
  license_type: string;
  license_issued_at?: string;
  license_expires_at?: string;
  notes?: string;
}

export interface LicenseUpdateInput {
  license_type?: string;
  license_issued_at?: string;
  license_expires_at?: string;
  notes?: string;
}

export interface LicenseProfile {
  id: string;
  full_name: string | null;
  role: string;
  sbu_id: string | null;
  licensed: boolean;
  license_type: string | null;
  license_issued_at: string | null;
  license_expires_at: string | null;
}

// ─────────────────────────────────────────────
// Assign licence to a staff member
// ─────────────────────────────────────────────
export async function assignLicense(
  input: LicenseAssignInput,
  performedBy: string,
): Promise<LicenseProfile> {
  const { profile_id, license_type, license_issued_at, license_expires_at, notes } = input;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sbu_id, licensed")
    .eq("id", profile_id)
    .single();

  if (fetchError || !existing) throw new Error("Profile not found");
  if ((existing as LicenseProfile).licensed) {
    throw new Error("Staff member already has an active licence. Use update instead.");
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      licensed: true,
      license_type,
      license_issued_at: license_issued_at ?? null,
      license_expires_at: license_expires_at ?? null,
    })
    .eq("id", profile_id)
    .select("id, full_name, role, sbu_id, licensed, license_type, license_issued_at, license_expires_at")
    .single();

  if (updateError) throw updateError;

  await supabaseAdmin.from("license_audit_log").insert({
    profile_id,
    action: "ASSIGNED",
    license_type,
    issued_at: license_issued_at ?? null,
    expires_at: license_expires_at ?? null,
    performed_by: performedBy,
    notes: notes ?? null,
  });

  await writeAuditLog({
    entity_type: "profile",
    entity_id: profile_id,
    action: "LICENSE_ASSIGNED",
    performed_by: performedBy,
    new_value: { license_type, license_issued_at, license_expires_at },
  });

  return updated as LicenseProfile;
}

// ─────────────────────────────────────────────
// Update existing licence
// ─────────────────────────────────────────────
export async function updateLicense(
  profileId: string,
  input: LicenseUpdateInput,
  performedBy: string,
): Promise<LicenseProfile> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, licensed, license_type, license_issued_at, license_expires_at")
    .eq("id", profileId)
    .single();

  if (fetchError || !existing) throw new Error("Profile not found");
  if (!(existing as LicenseProfile).licensed) {
    throw new Error("Staff member does not have a licence. Use assign instead.");
  }

  const updates: Record<string, unknown> = {};
  if (input.license_type !== undefined) updates.license_type = input.license_type;
  if (input.license_issued_at !== undefined) updates.license_issued_at = input.license_issued_at;
  if (input.license_expires_at !== undefined) updates.license_expires_at = input.license_expires_at;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", profileId)
    .select("id, full_name, role, sbu_id, licensed, license_type, license_issued_at, license_expires_at")
    .single();

  if (updateError) throw updateError;

  await supabaseAdmin.from("license_audit_log").insert({
    profile_id: profileId,
    action: "UPDATED",
    license_type: (updated as LicenseProfile).license_type,
    issued_at: (updated as LicenseProfile).license_issued_at,
    expires_at: (updated as LicenseProfile).license_expires_at,
    performed_by: performedBy,
    notes: input.notes ?? null,
  });

  await writeAuditLog({
    entity_type: "profile",
    entity_id: profileId,
    action: "LICENSE_UPDATED",
    performed_by: performedBy,
    new_value: updates,
  });

  return updated as LicenseProfile;
}

// ─────────────────────────────────────────────
// Revoke licence
// ─────────────────────────────────────────────
export async function revokeLicense(
  profileId: string,
  notes: string | undefined,
  performedBy: string,
): Promise<LicenseProfile> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, licensed, license_type")
    .eq("id", profileId)
    .single();

  if (fetchError || !existing) throw new Error("Profile not found");
  if (!(existing as LicenseProfile).licensed) {
    throw new Error("Staff member does not have an active licence.");
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      licensed: false,
      license_type: null,
      license_issued_at: null,
      license_expires_at: null,
    })
    .eq("id", profileId)
    .select("id, full_name, role, sbu_id, licensed, license_type, license_issued_at, license_expires_at")
    .single();

  if (updateError) throw updateError;

  await supabaseAdmin.from("license_audit_log").insert({
    profile_id: profileId,
    action: "REVOKED",
    license_type: (existing as LicenseProfile).license_type,
    issued_at: null,
    expires_at: null,
    performed_by: performedBy,
    notes: notes ?? null,
  });

  await writeAuditLog({
    entity_type: "profile",
    entity_id: profileId,
    action: "LICENSE_REVOKED",
    performed_by: performedBy,
    new_value: { licensed: false },
  });

  return updated as LicenseProfile;
}

// ─────────────────────────────────────────────
// List licensed staff
// ─────────────────────────────────────────────
export async function listLicensedStaff(opts?: {
  sbu_id?: string;
  licensed?: boolean;
}): Promise<LicenseProfile[]> {
  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, role, sbu_id, licensed, license_type, license_issued_at, license_expires_at",
    )
    .order("full_name", { ascending: true });

  if (opts?.sbu_id) query = query.eq("sbu_id", opts.sbu_id);
  if (opts?.licensed !== undefined) query = query.eq("licensed", opts.licensed);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LicenseProfile[];
}

// ─────────────────────────────────────────────
// Check if a user is currently licensed and active
// ─────────────────────────────────────────────
export async function isActiveLicensee(profileId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("licensed, license_expires_at")
    .eq("id", profileId)
    .single();

  if (error || !data) return false;

  const profile = data as { licensed: boolean; license_expires_at: string | null };
  if (!profile.licensed) return false;
  if (profile.license_expires_at && new Date(profile.license_expires_at) < new Date()) {
    return false;
  }
  return true;
}
