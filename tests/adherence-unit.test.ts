import { describe, expect, it } from "vitest";
import { summarizeAdherence } from "../src/lib/db/medicines";
import { splitStatements } from "../src/lib/db/driver";
import { SCHEMA } from "../src/lib/db/schema";
import { formatIstIso } from "../src/lib/time";

const minutesAgo = (m: number) => formatIstIso(new Date(Date.now() - m * 60_000));

describe("summarizeAdherence", () => {
  it("counts each status once and treats long-overdue pending doses as missed", () => {
    const stats = summarizeAdherence(
      [
        { status: "elder_confirmed", scheduled_at: minutesAgo(120) },
        { status: "skipped", scheduled_at: minutesAgo(60) },
        { status: "missed", scheduled_at: minutesAgo(300) },
        { status: "pending", scheduled_at: minutesAgo(200) },
        { status: "pending", scheduled_at: minutesAgo(10) },
        { status: "pending", scheduled_at: minutesAgo(-120) },
      ],
      2,
    );
    expect(stats).toEqual({
      elderConfirmed: 1,
      witnessed: 2,
      skipped: 1,
      missed: 2,
      pending: 2,
      dueOrPast: 5,
      elderConfirmationRate: 33.3,
    });
  });

  it("has no rate when nothing is confirmed or missed (skips are not failures)", () => {
    const stats = summarizeAdherence([{ status: "skipped", scheduled_at: minutesAgo(30) }], 0);
    expect(stats.elderConfirmationRate).toBeNull();
    expect(summarizeAdherence([], 0)).toMatchObject({ dueOrPast: 0, elderConfirmationRate: null });
  });
});

describe("splitStatements", () => {
  it("splits the schema into single statements without comments", () => {
    const stmts = splitStatements(SCHEMA);
    expect(stmts.length).toBeGreaterThan(10);
    for (const s of stmts) {
      expect(s).not.toMatch(/--/);
      expect(s).not.toContain(";");
      expect(s).toMatch(/^(CREATE|ALTER)/);
    }
  });
});
