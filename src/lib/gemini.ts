import { z } from "zod";
import { EMERGENCY_LINE, MEDICAL_DISCLAIMER } from "./constants";
import { listMedicines, listEvents } from "./db";
import { findEcosprinActive } from "./rules";
import { formatIstIso } from "./time";
import { randomUUID } from "crypto";
import type { DecisionCard } from "./types";

const CardSchema = z.object({
  severity: z.enum(["info", "review_required", "urgent_review"]),
  title: z.string().min(3).max(120),
  elder_line_hi: z.string().min(10).max(400),
  caretaker_line_hi: z.string().min(10).max(400),
  family_line_en: z.string().min(10).max(500),
  tell_doctor: z.string().min(5).max(300),
  // Reject prescription mutations
  changes_prescription: z.literal(false),
  dose_change: z.null().optional(),
});

/**
 * Gemini structured output: the same contract as {@link CardSchema}, sent as `responseSchema`
 * so the model must return this JSON shape. zod still validates it afterwards (defence in depth).
 */
export const CARD_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    severity: { type: "STRING", enum: ["info", "review_required", "urgent_review"] },
    title: { type: "STRING" },
    elder_line_hi: { type: "STRING" },
    caretaker_line_hi: { type: "STRING" },
    family_line_en: { type: "STRING" },
    tell_doctor: { type: "STRING" },
    changes_prescription: { type: "BOOLEAN" },
  },
  required: [
    "severity",
    "title",
    "elder_line_hi",
    "caretaker_line_hi",
    "family_line_en",
    "tell_doctor",
    "changes_prescription",
  ],
} as const;

/** Gemini models, tried in order; override with GEMINI_MODEL if Google renames/retires them. */
function geminiModels(): string[] {
  const env = process.env.GEMINI_MODEL;
  return env ? [env] : ["gemini-3.5-flash", "gemini-flash-lite-latest"];
}

async function callGemini(key: string, body: unknown): Promise<string> {
  let lastErr: unknown;
  for (const model of geminiModels()) {
    try {
      return await callGeminiModel(key, model, body);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gemini failed");
}

async function callGeminiModel(key: string, model: string, body: unknown): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  } finally {
    clearTimeout(t);
  }
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/** A Gemini safety card after zod validation (warn-only). */
export type GeneratedCard = z.infer<typeof CardSchema>;

const FORBIDDEN = [
  /\b(stop|start|quit|resume|restart|pause) (taking|using|giving)\b/i,
  /\bdiscontinu(e|ed|ing)\b/i,
  /\b(hold|withhold|pause|suspend) (this|that|the|her|his|your|all)? ?(medicine|medication|tablet|pill|dose|drug)s?\b/i,
  /\b(do not|don't|dont|never) (take|give) (it|this|that|the|her|his|your|any)\b/i,
  /\bskip ((your|her|his|the|this|a|today's|tonight's) )?(next )?(dose|tablet|pill|medicine)\b/i,
  /\b(reduce|halve|cut down|taper|double|triple)\b[^.]{0,25}\b(dose|dosage|tablets?|pills?|mg)\b/i,
  /\bswitch (to|from) [a-z]/i,
  /\b(instead of|in place of) (your|her|his|the) (medicine|tablet|pill|dose)\b/i,
  /\b(increas|decreas|reduc|rais|lower|doubl|halv|chang|adjust|cut)(e|ed|es|ing)? (the |her |his |your |a )?(dose|dosage)/i,
  /\b(dose|dosage) (to|up|down|increase|decrease)\b/i,
  /replace with/i,
  /dawai band/i,
  /dose badal/i,
  /band kar(o|ein|dein|de)/i,
  /\b(double|half|skip) (the )?dose/i,
  /\btake \d+(\.\d+)?\s?(mg|tablet|tab|pill)s?\b/i,
  /\btake (one|two|three|four|an extra|extra|another) (more )?(tablet|tab|pill|dose)s?\b/i,
];

/** Standard safety advice ("don't double the dose", "do not stop any medicine without asking the doctor") is allowed. */
const SAFE_ADVICE = [
  /\b(do not|don't|dont|never)\s+(double|change|adjust|alter|stop|skip|increase|reduce|halve)\b[^.!?\n]*?(dose|dosage|medicine|medication|tablet|pill)s?\b[^.!?\n]*?\b(without|unless|before|until)\b[^.!?\n]*?\b(doctor|pharmacist|clinician)\b/gi,
  /\b(do not|don't|dont|never)\s+(double|take a double|take an extra|make up)\b[^.!?\n]{0,30}\b(dose|missed dose)\b/gi,
  /\b(do not|don't|dont|never) (change|adjust|alter) (any|a|the|her|his|your) (dose|dosage|medicine|medication)s?\b/gi,
];

/** True when text suggests starting, stopping or changing a dose; such AI output is discarded. */
export function rejectsMutation(text: string): boolean {
  const scrubbed = SAFE_ADVICE.reduce((t, r) => t.replace(r, " "), text);
  return FORBIDDEN.some((r) => r.test(scrubbed));
}

/** Validate a Gemini card against the schema and the warn-only (no dose change) rule. */
export function validateWarnOnlyCard(raw: unknown): { ok: true; card: GeneratedCard } | { ok: false; error: string } {
  const parsed = CardSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const c = parsed.data;
  if (c.dose_change != null) {
    return { ok: false, error: "Card attempted a dose change" };
  }
  if (c.changes_prescription !== false) {
    return { ok: false, error: "Card attempted prescription change" };
  }
  const blob = `${c.elder_line_hi} ${c.caretaker_line_hi} ${c.family_line_en} ${c.tell_doctor}`;
  if (rejectsMutation(blob)) {
    return { ok: false, error: "Card text implies dose/prescription mutation" };
  }
  return { ok: true, card: c };
}

/** Deterministic offline card for the Brufen + Ecosprin bleeding-risk rule. */
export function offlineBrufenCard(hh: string, sourceEventId: string | null): DecisionCard {
  return {
    id: `card-${randomUUID()}`,
    household_id: hh,
    source_event_id: sourceEventId,
    severity: "review_required",
    title: "Brufen + Ecosprin: illustrative safety review",
    elder_line_hi:
      "Kamla ji, taking Brufen together with Ecosprin can raise the risk of bleeding. Nothing in your medicines was changed. Please talk to your doctor.",
    caretaker_line_hi:
      "Please do not give Brufen until the doctor says it is okay. Kamla ji's own entry stays on record.",
    family_line_en:
      "Self-reported Brufen with Ecosprin 75 on record. Potential interaction needs clinician review. No prescription changed.",
    tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
    disclaimer: MEDICAL_DISCLAIMER,
    emergency_line: EMERGENCY_LINE,
    cached: 1,
    created_at: formatIstIso(),
  };
}

/** Generate a warn-only safety card with Gemini (structured output), with offline fallbacks. */
export async function generateDecisionCard(input: {
  hh: string;
  sourceEventId: string | null;
  context: string;
  medicineHint?: string;
}): Promise<{ card: DecisionCard; source: "gemini" | "offline" }> {
  const key = process.env.GEMINI_API_KEY;
  const hint = (input.medicineHint ?? "").toLowerCase();
  const involvesBrufen = /brufen|ibuprofen/.test(hint) || /brufen/i.test(input.context);

  const genericOffline = (why: string): DecisionCard => ({
    id: `card-${randomUUID()}`,
    household_id: input.hh,
    source_event_id: input.sourceEventId,
    severity: "info" as const,
    title: "Care note (offline)",
    elder_line_hi:
      "This note was made without AI. None of your medicines were changed. Ask your doctor if you have questions.",
    caretaker_line_hi: "Follow Kamla ji's own record. Only she can mark a dose as taken.",
    family_line_en: `Safety note (made without AI): ${why}. No prescription changes.`,
    tell_doctor: "Review the week's ApnaHaath event log.",
    disclaimer: MEDICAL_DISCLAIMER,
    emergency_line: EMERGENCY_LINE,
    cached: 1,
    created_at: formatIstIso(),
  });

  if (!key) {
    if (involvesBrufen && (await findEcosprinActive(input.hh))) {
      return { card: offlineBrufenCard(input.hh, input.sourceEventId), source: "offline" };
    }
    return { card: genericOffline("Gemini key not configured"), source: "offline" };
  }

  const meds = (await listMedicines(input.hh, true)).map((m) => ({
    name: m.name,
    dose: m.dose,
    time: m.schedule_time,
  }));
  const recent = (await listEvents(input.hh, 12)).map((e) => ({
    type: e.type,
    actor: e.actor_name,
    payload: e.payload_json,
  }));

  const prompt = `You are a warn-only medication safety assistant for a family care log.
Return ONLY JSON matching this schema:
{"severity":"info"|"review_required"|"urgent_review","title":string,"elder_line_hi":string,"caretaker_line_hi":string,"family_line_en":string,"tell_doctor":string,"changes_prescription":false,"dose_change":null}

Rules:
- Never start/stop/change doses or medicines.
- Never give emergency triage; mention calling 108 only as general advice if needed in tell_doctor carefully.
- Use plain, simple English for all lines (elder_line_hi = short reassuring line for the elder, caretaker_line_hi = one instruction for the caretaker, family_line_en = briefing for family). Field names are legacy; write English.
- Context: ${input.context}
- Active medicines: ${JSON.stringify(meds)}
- Recent events: ${JSON.stringify(recent)}`;

  try {
    const text = await callGemini(key, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: CARD_RESPONSE_SCHEMA,
      },
    });
    const json = JSON.parse(stripFences(text)) as unknown;
    const validated = validateWarnOnlyCard(json);
    if (!validated.ok) throw new Error(validated.error);

    const c = validated.card;
    return {
      source: "gemini",
      card: {
        id: `card-${randomUUID()}`,
        household_id: input.hh,
        source_event_id: input.sourceEventId,
        severity: c.severity,
        title: c.title,
        elder_line_hi: c.elder_line_hi,
        caretaker_line_hi: c.caretaker_line_hi,
        family_line_en: c.family_line_en,
        tell_doctor: c.tell_doctor,
        disclaimer: MEDICAL_DISCLAIMER,
        emergency_line: EMERGENCY_LINE,
        cached: 0,
        created_at: formatIstIso(),
      },
    };
  } catch (e) {
    console.warn("[gemini] falling back to offline card:", e instanceof Error ? e.message : e);
    if (involvesBrufen && (await findEcosprinActive(input.hh))) {
      return { card: offlineBrufenCard(input.hh, input.sourceEventId), source: "offline" };
    }
    return {
      card: genericOffline("live Gemini output unavailable or rejected by the warn-only check"),
      source: "offline",
    };
  }
}

/** Summarise the recent care log for a doctor with Gemini; falls back to the plain log. */
export async function generateDoctorBrief(hh: string, elderName: string): Promise<string> {
  const events = await listEvents(hh, 30);
  const lines = events.map(
    (e) => `- ${e.created_at}: ${e.type} by ${e.actor_name}${e.medicine_id ? ` (${e.medicine_id})` : ""}`,
  );
  const base = [
    `Doctor brief: ${elderName} (ApnaHaath care log)`,
    MEDICAL_DISCLAIMER,
    EMERGENCY_LINE,
    "",
    "Week events:",
    ...lines,
    "",
    "No prescriptions were changed by software.",
  ].join("\n");

  const key = process.env.GEMINI_API_KEY;
  if (!key) return base;

  try {
    const text = await callGemini(key, {
      contents: [
        {
          parts: [
            {
              text: `Summarize this elderly care event log for a physician in under 120 words, plain text with short lines (no markdown). Do not change medicines or doses, and do not add a closing sign-off line. Log:\n${base}`,
            },
          ],
        },
      ],
    });
    const clean = (text || "")
      .replace(/\*\*|__|^#+\s*/gm, "")
      .replace(/^\s*[*-]\s+/gm, "- ")
      .replace(/(^|\n)\s*[-–]?\s*(please\s+)?consult (a |your |the )?(clinician|doctor|physician)\.?\s*$/i, "")
      .trim();
    if (!clean || rejectsMutation(clean)) return base;
    return `${clean}\n\n${EMERGENCY_LINE}\n${MEDICAL_DISCLAIMER}`;
  } catch {
    return base;
  }
}

/** Translate an elder-facing care/reminder message into the circle's preferred language.
 *  English and empty language skip the API. Failures, empty output, or a dose-change
 *  suggestion fall back to the original text. */
export async function translateCareMessage(text: string, language: string): Promise<string> {
  const original = text.trim();
  const lang = (language || "English").trim();
  if (!original || /^english$/i.test(lang)) return text;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return text;
  try {
    const raw = await callGemini(key, {
      contents: [
        {
          parts: [
            {
              text:
                `Translate the following care reminder into ${lang}. ` +
                "Keep names, medicine names, times and numbers unchanged. " +
                "Do not add medical advice. Do not suggest starting, stopping or changing any dose. " +
                "Return only the translation, with the same line breaks.\n\n" +
                original,
            },
          ],
        },
      ],
    });
    const clean = (raw || "").trim();
    if (!clean || rejectsMutation(clean)) return text;
    return clean;
  } catch {
    return text;
  }
}
