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
  touchLocalUpdatedAt,
} from "@/lib/storage";
import {
  hydrateFromStorage,
  isStoreHydrated,
  resetStoreForTests,
} from "@/lib/store";
import { STORAGE_KEY } from "@/lib/types";
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
});

describe("hydrate-then-decideSyncOnSignIn (real hydrateFromStorage)", () => {
  it("empty storage: hydrate leaves null watermark → conflict with remote", () => {
    withLocalStorageShim(() => {
      resetStoreForTests();
      expect(isStoreHydrated()).toBe(false);

      hydrateFromStorage();

      expect(isStoreHydrated()).toBe(true);
      const afterHydrate = getLocalUpdatedAtMs();
      expect(afterHydrate).toBeNull();
      expect(window.localStorage.getItem(LOCAL_UPDATED_AT_KEY)).toBeNull();

      const cloud = remote({
        updated_at: "2026-01-01T00:00:00.000Z",
        state: mergePersistedState({
          todos: [
            {
              id: "cloud-only",
              text: "Must not be wiped",
              completed: false,
              createdAt: 1,
            },
          ],
        }),
      });

      const decision = decideSyncOnSignIn(cloud, afterHydrate);
      expect(decision.action).toBe("conflict");
      if (decision.action === "conflict") {
        expect(decision.remote.state.todos[0]?.text).toBe("Must not be wiped");
      }
    });
  });

  it("local blob without watermark: hydrate still leaves null → conflict", () => {
    withLocalStorageShim(() => {
      const localBlob = mergePersistedState({
        todos: [
          {
            id: "local-todo",
            text: "Guest work",
            completed: false,
            createdAt: 2,
          },
        ],
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localBlob));
      // Intentionally no LOCAL_UPDATED_AT_KEY
      expect(window.localStorage.getItem(LOCAL_UPDATED_AT_KEY)).toBeNull();

      resetStoreForTests();
      hydrateFromStorage();

      const afterHydrate = getLocalUpdatedAtMs();
      expect(afterHydrate).toBeNull();

      const cloud = remote({
        updated_at: "2026-01-01T00:00:00.000Z",
        state: mergePersistedState({
          todos: [
            {
              id: "cloud-only",
              text: "Cloud work",
              completed: false,
              createdAt: 1,
            },
          ],
        }),
      });
      expect(decideSyncOnSignIn(cloud, afterHydrate).action).toBe("conflict");
    });
  });

  it("regression: stamping Date.now() would wipe older cloud via upload-local", () => {
    withLocalStorageShim(() => {
      const cloud = remote({ updated_at: "2026-01-01T00:00:00.000Z" });
      const wronglySeededNow = Date.parse("2026-09-14T12:00:00.000Z");
      expect(decideSyncOnSignIn(cloud, wronglySeededNow).action).toBe(
        "upload-local"
      );

      resetStoreForTests();
      hydrateFromStorage();
      expect(decideSyncOnSignIn(cloud, getLocalUpdatedAtMs()).action).toBe(
        "conflict"
      );
    });
  });
});
