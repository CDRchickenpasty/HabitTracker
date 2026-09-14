import type { PersistedState } from "@/lib/types";
import type { RemoteAppState } from "./sync";

export type SyncDecision =
  | { action: "upload-local" }
  | { action: "apply-remote"; remote: RemoteAppState }
  | { action: "conflict"; remote: RemoteAppState };

/**
 * Pure sign-in sync decision.
 * - No remote row → upload local (first device / empty cloud).
 * - Missing local watermark but remote exists → conflict (never silent overwrite).
 * - Remote newer than local watermark → conflict (UI chooses).
 * - Otherwise upload local (local is same age or newer).
 */
export function decideSyncOnSignIn(
  remote: RemoteAppState | null,
  localUpdatedAtMs: number | null
): SyncDecision {
  if (!remote) {
    return { action: "upload-local" };
  }
  // Unknown local age + existing cloud row = divergence → user must choose
  if (localUpdatedAtMs == null) {
    return { action: "conflict", remote };
  }
  const remoteMs = Date.parse(remote.updated_at);
  if (!Number.isFinite(remoteMs) || remoteMs > localUpdatedAtMs) {
    return { action: "conflict", remote };
  }
  return { action: "upload-local" };
}

/** Display identity for signed-in chrome. */
export function formatAccountIdentity(user: {
  email?: string | null;
  id: string;
}): string {
  const email = user.email?.trim();
  if (email) return email;
  return user.id;
}

export function isValidEmail(raw: string): boolean {
  const s = raw.trim();
  // Practical check — Supabase still validates server-side
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export type AccountUiPhase =
  | "guest-unconfigured"
  | "signed-out"
  | "link-sent"
  | "signed-in"
  | "busy";

export function accountPhase(input: {
  configured: boolean;
  user: { id: string } | null;
  linkSent: boolean;
  busy: boolean;
}): AccountUiPhase {
  if (!input.configured) return "guest-unconfigured";
  if (input.busy) return "busy";
  if (input.user) return "signed-in";
  if (input.linkSent) return "link-sent";
  return "signed-out";
}

/** Merge pulled remote blob through the same path as import (caller supplies merge). */
export function applyPulledRemoteState(
  remoteState: PersistedState,
  apply: (state: PersistedState) => void
): void {
  apply(remoteState);
}
