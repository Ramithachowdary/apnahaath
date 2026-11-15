import { listMedicines } from "./db";

/**
 * Deterministic clinical-schedule rule (NOT a model call):
 * Thyronorm and Shelcal must stay at least 4 hours apart.
 */
export async function checkThyronormShelcalGap(
  hh: string,
  proposed: { medicineName: string; scheduleTime: string },
): Promise<{ ok: true } | { ok: false; message_en: string }> {
  const meds = await listMedicines(hh, true);
  const isThy = /thyronorm|levothyrox|thyrox/i.test(proposed.medicineName);
  const isShel = /shelcal|calcium/i.test(proposed.medicineName);
  if (!isThy && !isShel) return { ok: true };
  const other = meds.find((m) => (isThy ? /shelcal|calcium/i : /thyronorm|levothyrox|thyrox/i).test(m.name));
  if (!other) return { ok: true };
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  if (Math.abs(toMin(proposed.scheduleTime) - toMin(other.schedule_time)) < 4 * 60) {
    return {
      ok: false,
      message_en: "Keep at least 4 hours between Thyronorm and Shelcal. This is a fixed rule in the app code, not an AI suggestion.",
    };
  }
  return { ok: true };
}

export async function findEcosprinActive(hh: string): Promise<boolean> {
  return (await listMedicines(hh, true)).some((m) => /ecosprin|aspirin/i.test(m.name));
}
