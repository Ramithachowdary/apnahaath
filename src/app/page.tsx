import { cookies } from "next/headers";
import CareApp from "@/components/CareApp";
import { SESSION_COOKIE } from "@/lib/constants";
import { googleConfigured } from "@/lib/google";

export default async function Home() {
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  return <CareApp hasSession={hasSession} googleEnabled={googleConfigured()} />;
}
