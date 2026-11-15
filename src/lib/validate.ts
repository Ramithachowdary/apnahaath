import { NextResponse } from "next/server";
import { z } from "zod";

/** Parse + validate a JSON request body with zod. Returns 400 on bad input. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

export const passcode = z.string().min(4).max(64);
export const pin = z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits");
export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM");
