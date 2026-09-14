"use client";

import { useCallback, useEffect, useState } from "react";
import { isCloudConfigured } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/client";
import {
  pullRemoteState,
  pushRemoteState,
  remoteIsNewer,
} from "@/lib/supabase/sync";
import type { PersistedState } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

interface AccountPanelProps {
  getLocalState: () => PersistedState;
  applyRemoteState: (state: PersistedState) => void;
  exportLocalJson: () => string;
}

export function AccountPanel({
  getLocalState,
  applyRemoteState,
  exportLocalJson,
}: AccountPanelProps) {
  const configured = isCloudConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{
    remote: PersistedState;
    updatedAt: string;
  } | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const downloadLocalFirst = useCallback(() => {
    try {
      const json = exportLocalJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `habit-tracker-pre-sync-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, [exportLocalJson]);

  const resolveAfterSignIn = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const remote = await pullRemoteState();
      if (!remote) {
        await pushRemoteState(getLocalState());
        setStatus("Signed in — local data uploaded to cloud.");
        return;
      }

      const localSavedAt = (() => {
        try {
          const raw = window.localStorage.getItem("habit-tracker-v2");
          // No precise timestamp — compare using a heuristic: if remote exists, ask
          return raw ? Date.now() - 1 : null;
        } catch {
          return null;
        }
      })();

      if (remoteIsNewer(remote.updated_at, localSavedAt)) {
        setConflict({ remote: remote.state, updatedAt: remote.updated_at });
        setStatus("Cloud has data — choose Keep local or Use cloud.");
      } else {
        await pushRemoteState(getLocalState());
        setStatus("Signed in — local data synced.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }, [getLocalState]);

  const sendMagicLink = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("Enter your email.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setStatus("Check your email for the magic link.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [email]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setConflict(null);
      setStatus("Signed out. Local data stays on this device.");
    } finally {
      setBusy(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      await pushRemoteState(getLocalState());
      setStatus("Synced to cloud.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }, [getLocalState]);

  if (!configured) {
    return (
      <fieldset className="mb-5 space-y-2">
        <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Cloud sync
        </legend>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Optional. Add{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          to enable magic-link sign-in and sync. The app works fully offline
          without them.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="mb-5 space-y-3">
      <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Cloud sync
      </legend>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Optional account via magic link. Local data always stays on this device.
      </p>

      {!user ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="cloud-email" className="sr-only">
            Email
          </label>
          <input
            id="cloud-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendMagicLink()}
            className="rounded-lg accent-bg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Send magic link
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Signed in as{" "}
            <span className="font-medium">{user.email ?? user.id}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void resolveAfterSignIn()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              Check cloud
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncNow()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              Sync now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void signOut()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {conflict && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
            Cloud data from {new Date(conflict.updatedAt).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800"
              onClick={() => {
                downloadLocalFirst();
                void pushRemoteState(getLocalState()).then(() => {
                  setConflict(null);
                  setStatus("Kept local and uploaded.");
                });
              }}
            >
              Keep local
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800"
              onClick={() => {
                downloadLocalFirst();
                applyRemoteState(conflict.remote);
                setConflict(null);
                setStatus("Loaded cloud data.");
              }}
            >
              Use cloud
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800"
              onClick={downloadLocalFirst}
            >
              Export local first
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300" role="status">
          {status}
        </p>
      )}
    </fieldset>
  );
}
