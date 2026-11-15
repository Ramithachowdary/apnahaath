import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appUrl, exchangeGoogleCode, googleAuthUrl, googleConfigured, googleRedirectUri } from "../src/lib/google";

const DEFAULT_URL = "https://apnahaath-ramithas-projects-88e2a822.vercel.app";

beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("googleConfigured and appUrl", () => {
  it("is configured only when both client id and secret are set", () => {
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "id";
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(googleConfigured()).toBe(true);
  });

  it("prefers APP_URL, then NEXT_PUBLIC_SITE_URL, and strips a trailing slash", () => {
    expect(appUrl()).toBe(DEFAULT_URL);
    process.env.NEXT_PUBLIC_SITE_URL = "https://apnahaath-care.vercel.app/";
    expect(appUrl()).toBe("https://apnahaath-care.vercel.app");
    process.env.APP_URL = "https://apnahaath-care.vercel.app/";
    expect(appUrl()).toBe("https://apnahaath-care.vercel.app");
  });

  it("builds the callback on the fixed app URL", () => {
    process.env.APP_URL = "https://apnahaath-care.vercel.app";
    expect(googleRedirectUri()).toBe("https://apnahaath-care.vercel.app/api/auth/google/callback");
  });
});

describe("googleAuthUrl", () => {
  it("includes the openid email profile scopes and a fixed redirect", () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    process.env.APP_URL = "https://apnahaath-care.vercel.app";
    const url = new URL(googleAuthUrl("state-abc"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://apnahaath-care.vercel.app/api/auth/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("exchangeGoogleCode", () => {
  function mockFetch(token: unknown, info: unknown, tokenOk = true, infoOk = true) {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/token")) {
        return { ok: tokenOk, status: tokenOk ? 200 : 400, json: async () => token };
      }
      return { ok: infoOk, status: infoOk ? 200 : 401, json: async () => info };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("exchanges a code for a normalised profile", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.APP_URL = "https://apnahaath-care.vercel.app";
    mockFetch({ access_token: "tok" }, { sub: "g-1", email: "Priya@Example.com", email_verified: true, name: "Priya" });
    await expect(exchangeGoogleCode("code-1")).resolves.toEqual({
      sub: "g-1",
      email: "priya@example.com",
      email_verified: true,
      name: "Priya",
    });
  });

  it("treats email_verified as the string true and falls back to the local-part for a missing name", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    mockFetch({ access_token: "tok" }, { sub: "g-1", email: "kamla@example.com", email_verified: "true" });
    await expect(exchangeGoogleCode("code-1")).resolves.toEqual({
      sub: "g-1",
      email: "kamla@example.com",
      email_verified: true,
      name: "kamla",
    });
  });

  it("throws when the token exchange fails", async () => {
    mockFetch({}, {}, false, true);
    await expect(exchangeGoogleCode("bad")).rejects.toThrow(/token exchange failed \(400\)/);
  });

  it("throws when the access token is missing", async () => {
    mockFetch({ token_type: "Bearer" }, {});
    await expect(exchangeGoogleCode("code")).rejects.toThrow(/no access token/);
  });

  it("throws when userinfo fails", async () => {
    mockFetch({ access_token: "tok" }, {}, true, false);
    await expect(exchangeGoogleCode("code")).rejects.toThrow(/userinfo failed \(401\)/);
  });

  it("throws when the profile is incomplete", async () => {
    mockFetch({ access_token: "tok" }, { name: "Priya" });
    await expect(exchangeGoogleCode("code")).rejects.toThrow(/incomplete profile/);
  });
});
