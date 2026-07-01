import crypto from "crypto";
import { supabaseAdmin } from "../supabaseServer";
import type { ExternalActionToken } from "../models/purchaseRequest";

const TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate a cryptographically random token, return the raw value and its SHA-256 hash.
 * Raw value is sent to the external actor by email only. Hash is stored in the DB.
 */
export function generateRawToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Create an external action token scoped to one entity and actor.
 * Returns the raw token to be included in the email link — it is NOT stored.
 */
export async function createExternalToken(opts: {
  entityType: string;
  entityId: string;
  actorEmail: string;
  actorType: string;
  allowedActions: string[];
  createdBy: string;
  expiryDays?: number;
}): Promise<string> {
  const { raw, hash } = generateRawToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (opts.expiryDays ?? TOKEN_EXPIRY_DAYS));

  // Revoke any existing active tokens for the same entity + actor before creating a new one
  await supabaseAdmin
    .from("external_action_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("entity_type", opts.entityType)
    .eq("entity_id", opts.entityId)
    .eq("actor_email", opts.actorEmail)
    .is("revoked_at", null)
    .is("used_at", null);

  const { error } = await supabaseAdmin.from("external_action_tokens").insert([
    {
      token_hash: hash,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      actor_email: opts.actorEmail,
      actor_type: opts.actorType,
      allowed_actions: opts.allowedActions,
      expires_at: expiresAt.toISOString(),
      created_by: opts.createdBy,
    },
  ]);
  if (error) throw error;

  return raw;
}

export type TokenValidationResult =
  | { valid: true; token: ExternalActionToken }
  | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED" };

/**
 * Validate a raw token from a URL param.
 * Also updates last_viewed_at and actor metadata without consuming the token.
 */
export async function validateToken(
  rawToken: string,
  opts?: { ip?: string; userAgent?: string },
): Promise<TokenValidationResult> {
  const hash = hashToken(rawToken);

  const { data, error } = await supabaseAdmin
    .from("external_action_tokens")
    .select("*")
    .eq("token_hash", hash)
    .single();

  if (error || !data) return { valid: false, reason: "NOT_FOUND" };

  const token = data as ExternalActionToken;

  if (token.revoked_at) return { valid: false, reason: "REVOKED" };
  if (token.used_at) return { valid: false, reason: "USED" };
  if (new Date(token.expires_at) < new Date()) return { valid: false, reason: "EXPIRED" };

  // Record view metadata (fire-and-forget; don't block response)
  supabaseAdmin
    .from("external_action_tokens")
    .update({
      last_viewed_at: new Date().toISOString(),
      last_actor_ip: opts?.ip ?? null,
      last_user_agent: opts?.userAgent ?? null,
    })
    .eq("id", token.id)
    .then(() => {})
    .catch((e) => console.error("[externalTokenService] view update failed", e));

  return { valid: true, token };
}

/**
 * Mark a token as used (single-use for approve/reject actions).
 * Also records the actor's IP and user agent at action time.
 */
export async function consumeToken(
  tokenId: string,
  opts?: { ip?: string; userAgent?: string },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("external_action_tokens")
    .update({
      used_at: new Date().toISOString(),
      last_actor_ip: opts?.ip ?? null,
      last_user_agent: opts?.userAgent ?? null,
    })
    .eq("id", tokenId);
  if (error) throw error;
}

/**
 * Revoke all active tokens for a given entity+actor combination.
 * Used when an admin manually revokes or regenerates a link.
 */
export async function revokeTokensForEntity(entityId: string, entityType: string): Promise<void> {
  await supabaseAdmin
    .from("external_action_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("revoked_at", null)
    .is("used_at", null);
}
