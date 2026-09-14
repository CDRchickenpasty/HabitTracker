import { mergePersistedState, touchLocalUpdatedAt } from "@/lib/storage";
import type { FocusSession, PersistedState } from "@/lib/types";
import { getSupabase } from "./client";

export { getLocalUpdatedAtMs, touchLocalUpdatedAt } from "@/lib/storage";

const CLIENT_ID_KEY = "habit-tracker-client-id";

export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export type RemoteAppState = {
  version: number;
  state: PersistedState;
  updated_at: string;
  client_id: string | null;
};

export class SyncAuthError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "SyncAuthError";
  }
}

export class SyncConfigError extends Error {
  constructor(message = "Cloud sync is not configured") {
    super(message);
    this.name = "SyncConfigError";
  }
}

async function requireUser() {
  const supabase = getSupabase();
  if (!supabase) throw new SyncConfigError();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new SyncAuthError();
  return { supabase, user };
}

export async function pullRemoteState(): Promise<RemoteAppState | null> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("app_state")
    .select("version, state, updated_at, client_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    version: data.version as number,
    state: mergePersistedState(data.state as Partial<PersistedState>),
    updated_at: data.updated_at as string,
    client_id: (data.client_id as string | null) ?? null,
  };
}

export async function pushRemoteState(state: PersistedState): Promise<void> {
  const { supabase, user } = await requireUser();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("app_state").upsert(
    {
      user_id: user.id,
      version: state.version,
      state,
      updated_at: updatedAt,
      client_id: getClientId(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  touchLocalUpdatedAt(Date.parse(updatedAt));
}

export async function pushFocusSession(session: FocusSession): Promise<void> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("focus_sessions").upsert(
    {
      id: session.id,
      user_id: user.id,
      completed_at: new Date(session.completedAt).toISOString(),
      local_date: session.localDate,
      planned_minutes: session.plannedMinutes,
      todo_text: session.todoTextSnapshot,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

/**
 * Decide whether remote should replace local on sign-in.
 * Caller shows UI when remote.updated_at is newer than localSavedAt.
 */
export function remoteIsNewer(
  remoteUpdatedAt: string,
  localSavedAtMs: number | null
): boolean {
  if (localSavedAtMs == null) return true;
  const remoteMs = Date.parse(remoteUpdatedAt);
  if (!Number.isFinite(remoteMs)) return true;
  return remoteMs > localSavedAtMs;
}

