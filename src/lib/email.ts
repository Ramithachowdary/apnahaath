import nodemailer from "nodemailer";
import { updateOutboxStatus } from "./db";
import type { ReminderOutbox } from "./types";

/** Sends via Gmail SMTP when GMAIL_USER/GMAIL_APP_PASSWORD are set; otherwise the in-app outbox is the record. */
export async function deliverOutboxRow(row: ReminderOutbox, outboxOnly = false, privateFooter = ""): Promise<void> {
  // privateFooter (e.g. a personal one-tap link) goes only into the email, never into the shared in-app outbox.
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (outboxOnly || !user || !pass) {
    await updateOutboxStatus(
      row.id,
      "mock",
      outboxOnly ? "Demo household: in-app outbox only" : "SMTP not configured: in-app outbox only",
    );
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `ApnaHaath <${user}>`,
      to: row.to_email,
      subject: row.subject,
      text: privateFooter ? `${row.body}\n\n${privateFooter}` : row.body,
    });
    await updateOutboxStatus(row.id, "sent");
  } catch (e) {
    await updateOutboxStatus(row.id, "failed", e instanceof Error ? e.message : "send failed");
  }
}

/** Direct transactional email (sign-up codes). Returns whether it was actually sent. */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ sent: boolean; error?: string }> {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!user || !pass) return { sent: false, error: "Email is not configured" };
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({ from: `ApnaHaath <${user}>`, to, subject, text });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed", e instanceof Error ? e.message : e);
    return { sent: false, error: "Could not send the email" };
  }
}
