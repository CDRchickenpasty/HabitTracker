import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ORIGIN,
  resolveEmailRedirectTo,
} from "./authRedirect";

describe("resolveEmailRedirectTo", () => {
  it("appends /auth/callback to http(s) origins", () => {
    expect(
      resolveEmailRedirectTo("https://habit-tracker-silk-three-56.vercel.app")
    ).toBe("https://habit-tracker-silk-three-56.vercel.app/auth/callback");
    expect(resolveEmailRedirectTo("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback"
    );
  });

  it("falls back to production callback when origin is missing", () => {
    expect(resolveEmailRedirectTo(undefined)).toBe(
      `${PRODUCTION_ORIGIN}/auth/callback`
    );
    expect(resolveEmailRedirectTo("")).toBe(
      `${PRODUCTION_ORIGIN}/auth/callback`
    );
  });
});
