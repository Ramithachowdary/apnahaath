import { buildLogoutResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  return buildLogoutResponse();
}
