import { mergePersistedState } from "@/lib/storage";
import type { FocusSession, PersistedState } from "@/lib/types";
import { getSupabase } from "./client";

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

export async function pullRemoteState(): Promise<RemoteAppState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  const supabase = getSupabase();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("app_state").upsert(
    {
      user_id: user.id,
      version: state.version,
      state,
      updated_at: new Date().toISOString(),
      client_id: getClientId(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

export async function pushFocusSession(session: FocusSession): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

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

export type ConflictChoice = "keep-local" | "use-cloud";

/**
 * Decide whether remote should replace local on sign-in.
 * Caller shows UI when remote.updated_at is newer than localSavedAt.
 */
export function remoteIsNewer(
  remoteUpdatedAt: string,
  localSavedAtMs: number | null
): boolean {
  if (localSavedAtMs == null) return true;
  return new Date(remoteUpdatedAt).getTime() > localSavedAtMs;
}
