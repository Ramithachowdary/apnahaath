/** Page-level routing rules shared by the sign-in, sign-up, onboarding and dashboard pages. */

/** The signed-in or account pages that guard their visitors. */
export type AppView = "signup" | "signin" | "onboarding" | "app";

/** The part of /api/auth/me that decides where a visitor belongs. */
export type SessionInfo = { authenticated: boolean; activeHouseholdId?: string | null };

/**
 * Where a visitor on `view` should be sent, or null when they are already on the right page.
 * Signed-out visitors may only see sign-up and sign-in; signed-in visitors without a care circle
 * go to onboarding; everyone with a circle goes to the dashboard. `search` keeps an invite code.
 */
export function routeFor(me: SessionInfo, view: AppView, search = ""): string | null {
  if (!me.authenticated) return view === "app" || view === "onboarding" ? `/signin${search}` : null;
  if (me.activeHouseholdId) return view === "app" ? null : "/app";
  return view === "onboarding" ? null : `/onboarding${search}`;
}

/** Copy an `invite` query value into a `?invite=` suffix for links, or "" when there is none. */
export function inviteQuery(invite: string | null | undefined): string {
  return invite ? `?invite=${encodeURIComponent(invite)}` : "";
}
