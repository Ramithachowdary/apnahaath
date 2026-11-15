import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withSession } from "@/lib/auth";
import { addMembershipStmt, batch, createHouseholdStmt } from "@/lib/db";
import { parseBody, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  elder_name: shortText(80),
  elder_age: z.number().int().min(1).max(120).nullable().optional(),
  city: shortText(80),
  language: z
    .enum(["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Other"])
    .default("English"),
  role: z.enum(["family", "caretaker", "elder"]).default("family"),
});

/** Create a care circle for an elder; the creator becomes owner with the chosen role. */
export async function POST(req: Request) {
  const u = await requireUser();
  if ("error" in u) return u.error;
  const p = await parseBody(req, Body);
  if ("error" in p) return p.error;
  const id = `hh-${randomUUID()}`;
  await batch([
    createHouseholdStmt({
      id,
      elder_name: p.data.elder_name,
      elder_age: p.data.elder_age ?? null,
      city: p.data.city,
      language: p.data.language,
      owner_user_id: u.user.id,
      is_demo: 0,
      demo_credentials_json: null,
    }),
    addMembershipStmt({
      id: `ms-${randomUUID()}`,
      user_id: u.user.id,
      household_id: id,
      role: p.data.role,
      pin_hash: "", // legacy column, unused
    }),
  ]);
  return withSession(NextResponse.json({ ok: true, householdId: id }), u.user.id, id);
}
