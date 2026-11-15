import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CareApp from "@/components/CareApp";
import { SESSION_COOKIE } from "@/lib/constants";
import { googleConfigured } from "@/lib/google";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) {
    const invite = (await searchParams).invite;
    redirect(invite ? `/signin?invite=${encodeURIComponent(invite)}` : "/signin");
  }
  return <CareApp hasSession googleEnabled={googleConfigured()} view="app" />;
}
