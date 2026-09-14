"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decideSyncOnSignIn,
  formatAccountIdentity,
  isValidEmail,
} from "@/lib/supabase/account";
import { resolveEmailRedirectTo } from "@/lib/supabase/authRedirect";
import { isCloudConfigured } from "@/lib/supabase/config";
import { getSupabase } from "@/lib/supabase/client";
import {
  getLocalUpdatedAtMs,
  pullRemoteState,
  pushRemoteState,
  SyncAuthError,
  SyncConfigError,
} from "@/lib/supabase/sync";
import type { PersistedState } from "@/lib/types";
import type { EmailOtpType, User } from "@supabase/supabase-js";

interface AccountPanelProps {
  getLocalState: () => PersistedState;
  applyRemoteState: (state: PersistedState) => void;
  exportLocalJson: () => string;
}

function errorMessage(e: unknown): string {
  if (e instanceof SyncAuthError) return "Sign in to sync with the cloud.";
  if (e instanceof SyncConfigError) {
    return "Cloud sync is not configured on this build.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong.";
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
  const [statusTone, setStatusTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sessionReady, setSessionReady] = useState(() => !isCloudConfigured());
  const [conflict, setConflict] = useState<{
    remote: PersistedState;
    updatedAt: string;
  } | null>(null);

  const syncingRef = useRef(false);
  const lastSyncedUserRef = useRef<string | null>(null);

  const setInfo = useCallback((msg: string) => {
    setStatusTone("info");
    setStatus(msg);
  }, []);

  const setError = useCallback((msg: string) => {
    setStatusTone("error");
    setStatus(msg);
  }, []);

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
      setInfo("Local backup downloaded.");
    } catch {
      setError("Could not export local backup.");
    }
  }, [exportLocalJson, setError, setInfo]);

  const resolveAfterSignIn = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const remote = await pullRemoteState();
      const decision = decideSyncOnSignIn(remote, getLocalUpdatedAtMs());

      if (decision.action === "upload-local") {
        await pushRemoteState(getLocalState());
        setConflict(null);
        setInfo(
          remote
            ? "Synced — your local data was uploaded."
            : "Signed in — local data uploaded to cloud."
        );
        return;
      }

      if (decision.action === "apply-remote") {
        applyRemoteState(decision.remote.state);
        setConflict(null);
        setInfo("Signed in — loaded your cloud data.");
        return;
      }

      setConflict({
        remote: decision.remote.state,
        updatedAt: decision.remote.updated_at,
      });
      setInfo("Cloud has newer data — choose Keep local or Use cloud.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      syncingRef.current = false;
    }
  }, [applyRemoteState, getLocalState, setError, setInfo]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    if (!supabase) {
      queueMicrotask(() => setSessionReady(true));
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (event === "SIGNED_IN" && next) {
        setLinkSent(false);
        if (lastSyncedUserRef.current !== next.id) {
          lastSyncedUserRef.current = next.id;
          void resolveAfterSignIn();
        }
      }
      if (event === "SIGNED_OUT") {
        lastSyncedUserRef.current = null;
        setConflict(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [configured, resolveAfterSignIn]);

  const sendMagicLink = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Cloud sync is not configured on this build.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: resolveEmailRedirectTo(),
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setLinkSent(true);
      setInfo(
        `Email sent to ${trimmed}. Check Inbox and Spam/Promotions for noreply@mail.app.supabase.io — then click the link, or paste the 6-digit code below.`
      );
    } catch (e) {
      setLinkSent(false);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, setError, setInfo]);

  const verifyOtpCode = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Cloud sync is not configured on this build.");
      return;
    }
    const trimmedEmail = email.trim();
    const token = otpCode.replace(/\s/g, "");
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter the same email you used for the link.");
      return;
    }
    if (!/^\d{6}$/.test(token)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const types: EmailOtpType[] = ["email", "magiclink", "signup"];
      let lastError: Error | null = null;
      for (const type of types) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token,
          type,
        });
        if (!error && data.session?.user) {
          setUser(data.session.user);
          setLinkSent(false);
          setOtpCode("");
          setInfo("Signed in with email code.");
          return;
        }
        if (error) lastError = error;
      }
      throw lastError ?? new Error("Invalid or expired code.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, otpCode, setError, setInfo]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setConflict(null);
      setLinkSent(false);
      lastSyncedUserRef.current = null;
      setInfo("Signed out. Local data stays on this device.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [setError, setInfo]);

  const syncNow = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      await pushRemoteState(getLocalState());
      setConflict(null);
      setInfo("Uploaded local data to cloud.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [getLocalState, setError, setInfo]);

  const pullNow = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const remote = await pullRemoteState();
      if (!remote) {
        setInfo("No cloud data yet — use Sync now to upload this device.");
        return;
      }
      setConflict({ remote: remote.state, updatedAt: remote.updated_at });
      setInfo("Cloud snapshot ready — choose Keep local or Use cloud.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [setError, setInfo]);

  if (!configured) {
    return (
      <fieldset className="mb-5 space-y-2" data-account-phase="guest-unconfigured">
        <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Account
        </legend>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Cloud accounts are optional. This build has no Supabase env configured,
          so you are using a guest profile on this device only. Add{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          to enable magic-link sign-in and sync.
        </p>
      </fieldset>
    );
  }

  if (!sessionReady) {
    return (
      <fieldset className="mb-5 space-y-2" data-account-phase="busy">
        <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Account
        </legend>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Checking account session…
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset
      className="mb-5 space-y-3"
      data-account-phase={user ? "signed-in" : linkSent ? "link-sent" : "signed-out"}
    >
      <legend className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Account
      </legend>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Optional Supabase account via email magic link. Guest mode still works —
        local data always stays on this device.
      </p>

      {!user ? (
        <div className="space-y-2">
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
              disabled={busy}
              onChange={(e) => {
                setEmail(e.target.value);
                setLinkSent(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void sendMagicLink();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendMagicLink()}
              className="rounded-lg accent-bg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : linkSent ? "Resend email" : "Send sign-in email"}
            </button>
          </div>
          {linkSent && (
            <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                Supabase sent the message from{" "}
                <strong>noreply@mail.app.supabase.io</strong>. It often lands in{" "}
                <strong>Spam</strong> or <strong>Promotions</strong>. Prefer the
                6-digit code if the link says expired.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="otp-code" className="sr-only">
                  6-digit code
                </label>
                <input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otpCode}
                  disabled={busy}
                  onChange={(e) => setOtpCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void verifyOtpCode();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void verifyOtpCode()}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  Verify code
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Signed in as{" "}
            <span className="font-medium" data-account-identity>
              {formatAccountIdentity(user)}
            </span>
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
              onClick={() => void pullNow()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              Pull from cloud
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
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40"
          data-account-conflict
        >
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
            Cloud data from {new Date(conflict.updatedAt).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800 disabled:opacity-50"
              onClick={() => {
                downloadLocalFirst();
                setBusy(true);
                void pushRemoteState(getLocalState())
                  .then(() => {
                    setConflict(null);
                    setInfo("Kept local and uploaded to cloud.");
                  })
                  .catch((e) => setError(errorMessage(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Keep local
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800 disabled:opacity-50"
              onClick={() => {
                downloadLocalFirst();
                applyRemoteState(conflict.remote);
                setConflict(null);
                setInfo("Loaded cloud data onto this device.");
              }}
            >
              Use cloud
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold dark:border-zinc-600 dark:bg-zinc-800 disabled:opacity-50"
              onClick={downloadLocalFirst}
            >
              Export local first
            </button>
          </div>
        </div>
      )}

      {status && (
        <p
          className={`text-xs font-medium ${
            statusTone === "error"
              ? "text-rose-700 dark:text-rose-300"
              : "text-zinc-600 dark:text-zinc-300"
          }`}
          role={statusTone === "error" ? "alert" : "status"}
          data-account-status
        >
          {status}
        </p>
      )}
    </fieldset>
  );
}
