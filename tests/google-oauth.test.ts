import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl, exchangeGoogleCode, googleAuthUrl, googleConfigured, googleRedirectUri } from "../src/lib/google";

const snapshot = { ...process.env };

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL", "NEXT_PUBLIC_SITE_URL"]) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

describe("googleConfigured / appUrl / redirect", () => {
  it("is false unless both client id and secret are set", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "id";
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(googleConfigured()).toBe(true);
  });

  it("prefers APP_URL, then NEXT_PUBLIC_SITE_URL, and strips a trailing slash", () => {
    process.env.APP_URL = "https://apnahaath-care.vercel.app/";
    expect(appUrl()).toBe("https://apnahaath-care.vercel.app");
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    expect(appUrl()).toBe("https://example.com");
    expect(googleRedirectUri()).toBe("https://example.com/api/auth/google/callback");
  });

  it("builds the authorization URL with the fixed callback and select_account prompt", () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    process.env.APP_URL = "https://apnahaath-care.vercel.app";
    const url = new URL(googleAuthUrl("state-xyz"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://apnahaath-care.vercel.app/api/auth/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("exchangeGoogleCode", () => {
  it("exchanges a code and normalises the profile", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.APP_URL = "https://apnahaath-care.vercel.app";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "tok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "g-1",
          email: "Ravi@Example.COM",
          email_verified: "true",
          name: "Ravi",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeGoogleCode("code-1")).resolves.toEqual({
      sub: "g-1",
      email: "ravi@example.com",
      email_verified: true,
      name: "Ravi",
    });
    const tokenBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("redirect_uri")).toBe("https://apnahaath-care.vercel.app/api/auth/google/callback");
  });

  it("falls back to the email local-part when no name is returned", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: "g-2", email: "meera@example.com", email_verified: true }),
        }),
    );
    const profile = await exchangeGoogleCode("code-2");
    expect(profile.name).toBe("meera");
    expect(profile.email_verified).toBe(true);
  });

  it("throws when the token exchange fails or no access token is returned", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }));
    await expect(exchangeGoogleCode("bad")).rejects.toThrow(/token exchange failed/);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(exchangeGoogleCode("bad")).rejects.toThrow(/no access token/);
  });

  it("throws when userinfo fails or the profile is incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }) })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }),
    );
    await expect(exchangeGoogleCode("x")).rejects.toThrow(/userinfo failed/);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: "g", email: "" }) }),
    );
    await expect(exchangeGoogleCode("x")).rejects.toThrow(/incomplete profile/);
  });
});
