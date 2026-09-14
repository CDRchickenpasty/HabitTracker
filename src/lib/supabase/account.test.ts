import { describe, expect, it } from "vitest";
import {
  accountPhase,
  applyPulledRemoteState,
  decideSyncOnSignIn,
  formatAccountIdentity,
  isValidEmail,
} from "./account";
import { remoteIsNewer } from "./sync";
import { getSupabaseConfig, isCloudConfigured } from "./config";
import {
  createDefaultPersistedState,
  getLocalUpdatedAtMs,
  LOCAL_UPDATED_AT_KEY,
  mergePersistedState,
  seedLocalUpdatedAtIfMissing,
  touchLocalUpdatedAt,
} from "@/lib/storage";
import type { RemoteAppState } from "./sync";

function withLocalStorageShim(run: () => void) {
  const store = new Map<string, string>();
  const g = globalThis as unknown as {
    window?: Window & typeof globalThis;
  };
  const prev = g.window;
  g.window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  } as unknown as Window & typeof globalThis;
  try {
    run();
  } finally {
    if (prev === undefined) delete g.window;
    else g.window = prev;
  }
}

function remote(
  partial: Partial<RemoteAppState> & { updated_at: string }
): RemoteAppState {
  return {
    version: 2,
    state: createDefaultPersistedState(),
    client_id: "test-client",
    ...partial,
  };
}

describe("account decideSyncOnSignIn", () => {
  it("uploads local when cloud has no row", () => {
    expect(decideSyncOnSignIn(null, Date.now())).toEqual({
      action: "upload-local",
    });
  });

  it("conflicts when local watermark is missing but remote exists", () => {
    const r = remote({ updated_at: "2026-09-14T00:00:00.000Z" });
    expect(decideSyncOnSignIn(r, null)).toEqual({
      action: "conflict",
      remote: r,
    });
  });

  it("conflicts when remote is newer than local watermark", () => {
    const r = remote({ updated_at: "2026-09-14T12:00:00.000Z" });
    const localMs = Date.parse("2026-09-14T10:00:00.000Z");
    expect(decideSyncOnSignIn(r, localMs)).toEqual({
      action: "conflict",
      remote: r,
    });
  });

  it("uploads local when local is same age or newer", () => {
    const r = remote({ updated_at: "2026-09-14T10:00:00.000Z" });
    expect(decideSyncOnSignIn(r, Date.parse("2026-09-14T10:00:00.000Z"))).toEqual(
      { action: "upload-local" }
    );
    expect(decideSyncOnSignIn(r, Date.parse("2026-09-14T11:00:00.000Z"))).toEqual(
      { action: "upload-local" }
    );
  });
});

describe("remoteIsNewer (shipped sync helper)", () => {
  it("treats missing local watermark as remote newer", () => {
    expect(remoteIsNewer("2026-09-14T00:00:00.000Z", null)).toBe(true);
  });

  it("compares parsed timestamps", () => {
    expect(
      remoteIsNewer(
        "2026-09-14T12:00:00.000Z",
        Date.parse("2026-09-14T11:00:00.000Z")
      )
    ).toBe(true);
    expect(
      remoteIsNewer(
        "2026-09-14T10:00:00.000Z",
        Date.parse("2026-09-14T11:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("account identity + email + phase", () => {
  it("prefers email then falls back to id", () => {
    expect(formatAccountIdentity({ id: "u1", email: "a@b.co" })).toBe("a@b.co");
    expect(formatAccountIdentity({ id: "u1", email: "  " })).toBe("u1");
    expect(formatAccountIdentity({ id: "u1", email: null })).toBe("u1");
  });

  it("validates emails used by the sign-in form", () => {
    expect(isValidEmail("sam@example.com")).toBe(true);
    expect(isValidEmail(" bad ")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("maps UI phases for guest / signed-out / link-sent / signed-in", () => {
    expect(
      accountPhase({
        configured: false,
        user: null,
        linkSent: false,
        busy: false,
      })
    ).toBe("guest-unconfigured");
    expect(
      accountPhase({
        configured: true,
        user: null,
        linkSent: false,
        busy: false,
      })
    ).toBe("signed-out");
    expect(
      accountPhase({
        configured: true,
        user: null,
        linkSent: true,
        busy: false,
      })
    ).toBe("link-sent");
    expect(
      accountPhase({
        configured: true,
        user: { id: "x" },
        linkSent: false,
        busy: false,
      })
    ).toBe("signed-in");
    expect(
      accountPhase({
        configured: true,
        user: { id: "x" },
        linkSent: false,
        busy: true,
      })
    ).toBe("busy");
  });
});

describe("pulled remote merge path", () => {
  it("runs apply with mergePersistedState output (same as import)", () => {
    const pulled = mergePersistedState({
      version: 2,
      todos: [{ id: "t1", text: "From cloud", completed: false, createdAt: 1 }],
      settings: { soundEnabled: false } as never,
    });
    let applied = createDefaultPersistedState();
    applyPulledRemoteState(pulled, (s) => {
      applied = s;
    });
    expect(applied.todos[0]?.text).toBe("From cloud");
    expect(applied.settings.soundEnabled).toBe(false);
    expect(applied.version).toBe(2);
  });
});

describe("cloud config gating", () => {
  it("reports configured only when both public env vars are set", () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(getSupabaseConfig()).toBeNull();
      expect(isCloudConfigured()).toBe(false);

      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
      expect(getSupabaseConfig()).toEqual({
        url: "https://example.supabase.co",
        anonKey: "anon-test-key",
      });
      expect(isCloudConfigured()).toBe(true);
    } finally {
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });
});

describe("local updated-at watermark", () => {
  it("round-trips through touchLocalUpdatedAt / getLocalUpdatedAtMs", () => {
    withLocalStorageShim(() => {
      const at = 1_725_000_000_000;
      touchLocalUpdatedAt(at);
      expect(getLocalUpdatedAtMs()).toBe(at);
    });
  });

  it("seedLocalUpdatedAtIfMissing writes once and preserves existing", () => {
    withLocalStorageShim(() => {
      expect(getLocalUpdatedAtMs()).toBeNull();
      const seeded = seedLocalUpdatedAtIfMissing(1_700_000_000_000);
      expect(seeded).toBe(1_700_000_000_000);
      expect(getLocalUpdatedAtMs()).toBe(1_700_000_000_000);
      expect(seedLocalUpdatedAtIfMissing(1_800_000_000_000)).toBe(
        1_700_000_000_000
      );
      expect(window.localStorage.getItem(LOCAL_UPDATED_AT_KEY)).toBe(
        "1700000000000"
      );
    });
  });
});
