import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUser, listUserHouseholds } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  const user = s ? await getUser(s.uid) : undefined;
  if (!s || !user) return NextResponse.json({ authenticated: false });
  const households = await listUserHouseholds(user.id);
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email },
    households,
    activeHouseholdId: households.some((h) => h.id === s.hid) ? s.hid : null,
  });
}
