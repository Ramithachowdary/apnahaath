import { afterEach, describe, expect, it, vi } from "vitest";
import { rejectsMutation, validateWarnOnlyCard } from "../src/lib/gemini";

const FORBIDDEN = [
  "Please stop taking Telma.",
  "Start taking an extra tablet tonight.",
  "Quit taking Glycomet if sugar is low.",
  "Resume taking Shelcal tomorrow.",
  "Restart taking Thyronorm at a new time.",
  "Pause taking Ecosprin this week.",
  "Discontinue Ecosprin for now.",
  "The medicine was discontinued last week on our advice.",
  "Hold this medicine until Monday.",
  "Withhold the tablet if sugar is low.",
  "Pause this medication until the review.",
  "Suspend the dose today.",
  "Do not take her Glycomet tonight.",
  "Don't take this tablet in the morning.",
  "Dont take it with milk.",
  "Never give any of these pills without asking us first? Wait, never give any tonight.",
  "Never take any of her medicines tonight.",
  "Skip your dose of Shelcal today.",
  "Skip next tablet if you feel dizzy.",
  "Reduce Telma to half a tablet.",
  "Halve the dose of Glycomet.",
  "Cut down the dosage of Telma.",
  "Taper the dose over a week.",
  "Double the dose tomorrow.",
  "Triple the pills this evening.",
  "Switch to paracetamol instead.",
  "Switch from Ecosprin to a different brand.",
  "Use this instead of your medicine tonight.",
  "In place of the tablet, take lime water.",
  "Increase the dose to 80 mg.",
  "Decrease the dosage gradually.",
  "Reduce the dose of Telma.",
  "Raise the dose next week.",
  "Lower the dosage after food.",
  "Adjust the dose yourself.",
  "Change the dose on Sunday.",
  "Cut the dose in half tonight.",
  "Dose to increase after the visit? Please dose to increase now.",
  "The dosage up is needed tonight.",
  "Replace with a different pain tablet.",
  "Is dawai band kar do.",
  "Please dawai band this week.",
  "Doctor said dose badal dena.",
  "Yeh dawai band karo.",
  "Band karein immediately after dinner.",
  "Isko band kardein from tonight.",
  "Bas band karde this tablet.",
  "Double the dose of Thyronorm.",
  "Half the dose tonight.",
  "Skip the dose if she is fasting.",
  "Take 50 mg now.",
  "Take 2.5 tablets of Brufen.",
  "Take 10tabs of the pain killer.",
  "Take one tablet of Brufen now.",
  "Take two pills now.",
  "Take an extra dose at bedtime.",
  "Take extra tablet tonight.",
  "Take another pill in an hour.",
  "Take one more tablet after food.",
];

const SAFE = [
  "Brufen with Ecosprin can increase the risk of stomach bleeding; she took 400 mg today.",
  "Do not double the dose to make up for a missed one.",
  "Don't double the dose if a dose was missed.",
  "Do not change any medicine without asking the doctor.",
  "Never stop any medication without asking the clinician.",
  "Do not adjust the dose without asking the pharmacist.",
  "Do not take a double dose.",
  "Don't make up a missed dose.",
  "Tell Dr. Sharma about the knee pain and the Brufen.",
  "Kamla has lower back pain and took Brufen 400 mg.",
  "The dose is due at 8:00 AM. Only she can mark it as taken.",
  "Skipped doses are never reported as missed. Please check in kindly.",
  "Please talk to your doctor if the pain continues.",
  "Confirm whether today's morning dose was taken.",
  "A caretaker can only witness; they cannot mark it taken.",
];

describe("rejectsMutation", () => {
  it.each(FORBIDDEN)("rejects: %s", (text) => {
    expect(rejectsMutation(text)).toBe(true);
  });

  it.each(SAFE)("allows: %s", (text) => {
    expect(rejectsMutation(text)).toBe(false);
  });
});

const validCard = {
  severity: "review_required" as const,
  title: "Brufen and Ecosprin review",
  elder_line_hi: "Please talk to your doctor about this combination today.",
  caretaker_line_hi: "Please keep a note of the pain tablet she already took.",
  family_line_en: "Self-reported Brufen with Ecosprin on record. Potential interaction needs clinician review.",
  tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
  changes_prescription: false as const,
  dose_change: null,
};

describe("validateWarnOnlyCard", () => {
  it("accepts a complete warn-only card", () => {
    const r = validateWarnOnlyCard(validCard);
    expect(r).toEqual({ ok: true, card: validCard });
  });

  it("rejects a card that is missing required fields", () => {
    const r = validateWarnOnlyCard({ title: "Hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("rejects a card whose schema allows a prescription change", () => {
    const r = validateWarnOnlyCard({ ...validCard, changes_prescription: true });
    expect(r.ok).toBe(false);
  });

  it("rejects a card that tries to set a dose change", () => {
    const r = validateWarnOnlyCard({ ...validCard, dose_change: "50 mg" });
    expect(r.ok).toBe(false);
  });

  it("rejects a card whose text implies a dose change", () => {
    const r = validateWarnOnlyCard({
      ...validCard,
      family_line_en: "Please stop taking Telma until the next visit with the doctor.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mutation/i);
  });

  it("rejects a title that is too short", () => {
    expect(validateWarnOnlyCard({ ...validCard, title: "Hi" }).ok).toBe(false);
  });
});
