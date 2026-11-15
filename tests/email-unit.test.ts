import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));
vi.mock("../src/lib/db", () => ({
  updateOutboxStatus: vi.fn(),
}));

import nodemailer from "nodemailer";
import { updateOutboxStatus } from "../src/lib/db";
import { deliverOutboxRow, sendEmail } from "../src/lib/email";
import type { ReminderOutbox } from "../src/lib/types";

const update = vi.mocked(updateOutboxStatus);
const createTransport = vi.mocked(nodemailer.createTransport);

const row = (over: Partial<ReminderOutbox> = {}): ReminderOutbox => ({
  id: "out-1",
  household_id: "hh",
  kind: "upcoming",
  to_email: "family@example.com",
  subject: "A dose is coming up",
  body: "Kamla has Thyronorm due at 8:00 AM IST.",
  idempotency_key: "hh:upcoming:1",
  status: "queued",
  created_at: "2026-11-15T07:00:00+05:30",
  sent_at: null,
  error: null,
  ...over,
});

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: "1" });
  update.mockReset().mockResolvedValue(undefined);
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

describe("sendEmail", () => {
  it("returns sent:false when SMTP is not configured", async () => {
    expect(await sendEmail("a@example.com", "Hi", "Body")).toEqual({ sent: false, error: "Email is not configured" });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("sends via Gmail SMTP and strips spaces in the app password", async () => {
    process.env.GMAIL_USER = "bot@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(await sendEmail("a@example.com", "Hi", "Body")).toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "bot@gmail.com", pass: "abcdefghijklmnop" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "ApnaHaath <bot@gmail.com>",
      to: "a@example.com",
      subject: "Hi",
      text: "Body",
    });
  });

  it("returns a generic error when the transport throws", async () => {
    process.env.SMTP_USER = "bot@gmail.com";
    process.env.SMTP_PASS = "secret";
    sendMail.mockRejectedValue(new Error("relay denied"));
    expect(await sendEmail("a@example.com", "Hi", "Body")).toEqual({ sent: false, error: "Could not send the email" });
  });
});

describe("deliverOutboxRow", () => {
  it("marks the row as mock when asked to keep it in-app only", async () => {
    process.env.GMAIL_USER = "bot@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "secret";
    await deliverOutboxRow(row(), true);
    expect(update).toHaveBeenCalledWith("out-1", "mock", "Demo household: in-app outbox only");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("marks the row as mock when SMTP is not configured", async () => {
    await deliverOutboxRow(row());
    expect(update).toHaveBeenCalledWith("out-1", "mock", "SMTP not configured: in-app outbox only");
  });

  it("sends the email and appends a private footer that never goes to the shared outbox", async () => {
    process.env.GMAIL_USER = "bot@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "secret";
    await deliverOutboxRow(row(), false, "Personal link: https://example/t");
    expect(sendMail).toHaveBeenCalledWith({
      from: "ApnaHaath <bot@gmail.com>",
      to: "family@example.com",
      subject: "A dose is coming up",
      text: "Kamla has Thyronorm due at 8:00 AM IST.\n\nPersonal link: https://example/t",
    });
    expect(update).toHaveBeenCalledWith("out-1", "sent");
  });

  it("records a failure when sendMail throws", async () => {
    process.env.GMAIL_USER = "bot@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "secret";
    sendMail.mockRejectedValue(new Error("quota"));
    await deliverOutboxRow(row());
    expect(update).toHaveBeenCalledWith("out-1", "failed", "quota");
  });

  it("records a generic failure when a non-Error is thrown", async () => {
    process.env.GMAIL_USER = "bot@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "secret";
    sendMail.mockRejectedValue("boom");
    await deliverOutboxRow(row());
    expect(update).toHaveBeenCalledWith("out-1", "failed", "send failed");
  });
});
