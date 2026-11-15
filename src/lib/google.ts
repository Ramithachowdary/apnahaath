/** Google sign-in via the plain OAuth 2.0 authorization-code flow (no SDK). */
export const GOOGLE_STATE_COOKIE = "apnahaath_g_state";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Fixed public base URL: the OAuth redirect URI must match Google Console exactly, so it is never built from the request host. */
export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://apnahaath-ramithas-projects-88e2a822.vercel.app"
  ).replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name: string };

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tok.ok) throw new Error(`token exchange failed (${tok.status})`);
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!access_token) throw new Error("no access token");
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!info.ok) throw new Error(`userinfo failed (${info.status})`);
  const p = (await info.json()) as { sub?: string; email?: string; email_verified?: boolean | string; name?: string };
  if (!p.sub || !p.email) throw new Error("incomplete profile");
  return {
    sub: p.sub,
    email: p.email.toLowerCase(),
    email_verified: p.email_verified === true || p.email_verified === "true",
    name: p.name || p.email.split("@")[0],
  };
}
