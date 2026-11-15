import { z } from "zod";
import { EMERGENCY_LINE } from "./constants";
import { rejectsMutation } from "./gemini";
import { formatIstIso, formatTime12 } from "./time";
import type { DecisionCard } from "./types";

/**
 * Care Communication Engine (Adaption Responses API).
 * Gemini decides WHAT the safety note is (warn-only card). Adaption only rewrites an
 * already-validated card into three role-specific messages. It never decides or changes doses.
 * API: POST https://api.prod.adaptionlabs.ai/api/v1/responses  (Bearer ADAPTION_API_KEY)
 *      body { model, instructions, input, max_output_tokens, temperature } -> { output_text }
 *      model may be a hosted model id or `stack:<slug>` (ADAPTION_STACK_ID).
 */
const MessagesSchema = z.object({
  elder: z.string().min(5).max(300),
  caretaker: z.string().min(5).max(300),
  family: z.string().min(10).max(900),
});
/** Three role-specific messages (elder, caretaker, family) phrased from one safety card. */
export type CareMessages = z.infer<typeof MessagesSchema>;

/** Validate Adaption output with zod and reject any line that suggests a dose change. */
export function validateCareMessages(
  raw: unknown,
): { ok: true; messages: CareMessages } | { ok: false; error: string } {
  const p = MessagesSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.message };
  const blob = `${p.data.elder} ${p.data.caretaker} ${p.data.family}`;
  if (rejectsMutation(blob)) return { ok: false, error: "Message implies a dose/prescription change" };
  return { ok: true, messages: p.data };
}

/** Offline template messages used when Adaption is off, slow or rejected. */
export function templateMessages(card: DecisionCard, elderName: string): CareMessages {
  const time = formatTime12(formatIstIso());
  return {
    elder: /\bji\b/.test(card.elder_line_hi)
      ? card.elder_line_hi
      : `${elderName.split(" ")[0]} ji, ${card.elder_line_hi}`,
    caretaker: card.caretaker_line_hi,
    family: [
      `${time} IST: ${card.title}`,
      card.family_line_en,
      `For the doctor: ${card.tell_doctor}`,
      "No prescription or dose was changed by ApnaHaath.",
      EMERGENCY_LINE,
    ].join("\n"),
  };
}

/** Call Adaption's Responses API and parse a JSON object from output_text. Throws on any failure. */
export async function adaptionJson(instructions: string, input: unknown, maxTokens = 400): Promise<unknown> {
  const key = process.env.ADAPTION_API_KEY;
  if (!key) throw new Error("ADAPTION_API_KEY not set");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch("https://api.prod.adaptionlabs.ai/api/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: adaptionModel(),
        instructions,
        input: JSON.stringify(input),
        max_output_tokens: maxTokens,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Adaption HTTP ${res.status}`);
    const data = (await res.json()) as { output_text?: string };
    const text = (data.output_text ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function adaptionModel(): string {
  if (process.env.ADAPTION_STACK_ID) return `stack:${process.env.ADAPTION_STACK_ID}`;
  return process.env.ADAPTION_MODEL || "gemma-4-31b-it";
}

/** Ask Adaption to phrase a validated safety card for each role; falls back to templates. */
export async function generateCareMessages(
  card: DecisionCard,
  elderName: string,
): Promise<{ messages: CareMessages; source: "adaption" | "template"; error?: string }> {
  const fallback = templateMessages(card, elderName);
  const key = process.env.ADAPTION_API_KEY;
  if (!key) return { messages: fallback, source: "template", error: "ADAPTION_API_KEY not set" };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://api.prod.adaptionlabs.ai/api/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: adaptionModel(),
        instructions:
          "You rewrite an already-approved medication safety note for a family care circle. Plain simple English. " +
          "Never suggest starting, stopping, or changing any medicine or dose. Return ONLY JSON: " +
          '{"elder": short reassuring line (<=2 sentences), "caretaker": exactly one instruction, "family": 3-5 lines with IST time}.',
        input: JSON.stringify({
          elder_name: elderName,
          now_ist: formatIstIso(),
          card: {
            title: card.title,
            severity: card.severity,
            elder_line: card.elder_line_hi,
            caretaker_line: card.caretaker_line_hi,
            family_line: card.family_line_en,
            tell_doctor: card.tell_doctor,
          },
        }),
        max_output_tokens: 400,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Adaption HTTP ${res.status}`);
    const data = (await res.json()) as { output_text?: string };
    const text = (data.output_text ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const v = validateCareMessages(JSON.parse(text));
    if (!v.ok) throw new Error(v.error);
    return { messages: v.messages, source: "adaption" };
  } catch (e) {
    return { messages: fallback, source: "template", error: e instanceof Error ? e.message : "Adaption failed" };
  } finally {
    clearTimeout(t);
  }
}
