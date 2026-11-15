import { describe, expect, it } from "vitest";
import { hhmm, parseBody, passcode, shortText } from "../src/lib/validate";

describe("passcode schema", () => {
  it.each(["abcd", "1234", "A".repeat(64), "good-pass phrase 99"])("accepts %s", (value) => {
    expect(passcode.safeParse(value).success).toBe(true);
  });

  it.each(["", "abc", "A".repeat(65)])("rejects %s", (value) => {
    expect(passcode.safeParse(value).success).toBe(false);
  });
});

describe("shortText schema", () => {
  it("trims and accepts a normal name", () => {
    expect(shortText().parse("  Kamla Devi  ")).toBe("Kamla Devi");
  });

  it("rejects empty, whitespace-only and over-long values", () => {
    expect(shortText(10).safeParse("").success).toBe(false);
    expect(shortText(10).safeParse("   ").success).toBe(false);
    expect(shortText(10).safeParse("x".repeat(11)).success).toBe(false);
    expect(shortText(10).safeParse("x".repeat(10)).success).toBe(true);
  });
});

describe("hhmm schema", () => {
  it.each(["00:00", "00:59", "09:05", "12:00", "13:45", "23:59"])("accepts %s", (value) => {
    expect(hhmm.safeParse(value).success).toBe(true);
  });

  it.each(["9:00", "24:00", "12:60", "12:0", "ab:cd", "25:01", "08:5", "", "7:30 AM", "08:00:00"])(
    "rejects %s",
    (value) => {
      expect(hhmm.safeParse(value).success).toBe(false);
    },
  );
});

describe("parseBody", () => {
  const schema = shortText(40);

  it("returns data for a valid JSON body", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify("Hello"),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(req, schema);
    expect(result).toEqual({ data: "Hello" });
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "{not-json",
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(req, schema);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(400);
  });

  it("returns 400 with issue messages when the schema fails", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(""),
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(req, schema);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.error).toBe("Invalid request");
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
    }
  });
});
