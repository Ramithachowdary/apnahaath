import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CareApp from "@/components/CareApp";
import { SESSION_COOKIE } from "@/lib/constants";
import { inviteQuery } from "@/lib/routing";

export const metadata: Metadata = { title: "Set up your care circle", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) {
    const invite = (await searchParams).invite;
    redirect(`/signin${inviteQuery(invite)}`);
  }
  return <CareApp view="onboarding" />;
}
