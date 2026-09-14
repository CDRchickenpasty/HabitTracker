/** Canonical production origin for magic-link redirects. */
export const PRODUCTION_ORIGIN =
  "https://habit-tracker-silk-three-56.vercel.app";

/**
 * Prefer the current browser origin when it is http(s); fall back to production.
 * Always returns an absolute URL Supabase can allow-list (callback path).
 */
export function resolveEmailRedirectTo(
  origin: string | undefined = typeof window !== "undefined"
    ? window.location.origin
    : undefined
): string {
  const raw = (origin ?? "").trim().replace(/\/$/, "");
  const base =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : PRODUCTION_ORIGIN;
  return `${base}/auth/callback`;
}
