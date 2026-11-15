import { describe, expect, it } from "vitest";
import { inviteQuery, routeFor } from "../src/lib/routing";

const signedOut = { authenticated: false };
const noCircle = { authenticated: true, activeHouseholdId: null };
const withCircle = { authenticated: true, activeHouseholdId: "h1" };

describe("routeFor", () => {
  it("keeps signed-out visitors on sign-up and sign-in, and sends them there from private pages", () => {
    expect(routeFor(signedOut, "signup")).toBeNull();
    expect(routeFor(signedOut, "signin")).toBeNull();
    expect(routeFor(signedOut, "app", "?invite=abc")).toBe("/signin?invite=abc");
    expect(routeFor(signedOut, "onboarding")).toBe("/signin");
  });

  it("sends a signed-in visitor without a care circle to onboarding, keeping the invite", () => {
    expect(routeFor(noCircle, "onboarding")).toBeNull();
    expect(routeFor(noCircle, "signin", "?invite=abc")).toBe("/onboarding?invite=abc");
    expect(routeFor(noCircle, "app")).toBe("/onboarding");
  });

  it("sends everyone with a care circle to the dashboard", () => {
    expect(routeFor(withCircle, "app")).toBeNull();
    expect(routeFor(withCircle, "signup")).toBe("/app");
    expect(routeFor(withCircle, "onboarding", "?invite=abc")).toBe("/app");
  });
});

describe("inviteQuery", () => {
  it("encodes an invite code and is empty without one", () => {
    expect(inviteQuery("a b&c")).toBe("?invite=a%20b%26c");
    expect(inviteQuery("")).toBe("");
    expect(inviteQuery(null)).toBe("");
    expect(inviteQuery(undefined)).toBe("");
  });
});
