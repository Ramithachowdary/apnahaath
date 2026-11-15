import nodemailer from "nodemailer";
import { updateOutboxStatus } from "./db";
import type { ReminderOutbox } from "./types";

/** Sends via Gmail SMTP when GMAIL_USER/GMAIL_APP_PASSWORD are set; otherwise the in-app outbox is the record. */
export async function deliverOutboxRow(row: ReminderOutbox, outboxOnly = false): Promise<void> {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (outboxOnly || !user || !pass) {
    await updateOutboxStatus(row.id, "mock", outboxOnly ? "Demo household — in-app outbox only" : "SMTP not configured — in-app outbox only");
    return;
  }
  try {
    const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await transporter.sendMail({ from: `ApnaHaath <${user}>`, to: row.to_email, subject: row.subject, text: row.body });
    await updateOutboxStatus(row.id, "sent");
  } catch (e) {
    await updateOutboxStatus(row.id, "failed", e instanceof Error ? e.message : "send failed");
  }
}
