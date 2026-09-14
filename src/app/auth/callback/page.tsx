"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { isCloudConfigured } from "@/lib/supabase/config";

/**
 * Landing page for magic-link / confirm redirects.
 * Supabase puts tokens in the URL hash; detectSessionInUrl on the client
 * picks them up — this page waits briefly then returns home.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState(() =>
    isCloudConfigured()
      ? "Finishing sign-in…"
      : "Cloud auth is not configured."
  );

  useEffect(() => {
    if (!isCloudConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    void (async () => {
      // Give detectSessionInUrl a moment to exchange the hash tokens
      await new Promise((r) => setTimeout(r, 250));
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) {
        setMessage("Signed in — taking you back…");
        router.replace("/");
        return;
      }
      setMessage(
        "No session found. The link may have expired — request a new email and use the 6-digit code."
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <p
        className="max-w-md rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        role="status"
      >
        {message}
      </p>
    </main>
  );
}
