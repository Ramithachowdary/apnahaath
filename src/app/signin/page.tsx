import type { Metadata } from "next";
import { cookies } from "next/headers";
import CareApp from "@/components/CareApp";
import { SESSION_COOKIE } from "@/lib/constants";
import { googleConfigured } from "@/lib/google";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page() {
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  return <CareApp hasSession={hasSession} googleEnabled={googleConfigured()} view="signin" />;
}
