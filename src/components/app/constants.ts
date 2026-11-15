/** UI labels: tabs, dose status words (never colour alone), roles and event names. */
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  History as HistoryIcon,
  MinusCircle,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import type { Role } from "./types";

export const SKIP_REASONS = ["Fasting", "Upset stomach", "Ran out", "Forgot", "Other"];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Not answered yet",
  elder_confirmed: "Taken — confirmed by the elder",
  skipped: "Skipped",
  missed: "Missed / not confirmed",
};

export const ROLE_LABEL: Record<Role, string> = { elder: "Elder", caretaker: "Caretaker", family: "Family" };

export const EVENT_LABEL: Record<string, string> = {
  elder_confirmed: "confirmed a dose",
  witnessed: "witnessed a dose (not counted as taken)",
  skipped: "skipped a dose",
  missed: "— dose not confirmed in time",
  self_added: "recorded a medicine she took herself",
  change_proposed: "suggested a change",
  stop_proposed: "suggested stopping a medicine",
  change_accepted: "accepted a suggestion",
  change_rejected: "said no to a suggestion",
  appointment_created: "added an appointment",
  appointment_updated: "updated an appointment",
  member_joined: "joined the care circle",
};

export const TABS = ["Today", "Medicines", "History", "Appointments", "Care circle", "Safety & AI"] as const;

export const TAB_ICON = {
  Today: CalendarCheck,
  Medicines: Pill,
  History: HistoryIcon,
  Appointments: Stethoscope,
  "Care circle": Users,
  "Safety & AI": ShieldCheck,
} as const;

export const TAB_SUB: Record<string, string> = {
  Today: "Today's doses. Only the elder marks a dose as taken.",
  Medicines: "The medicine list. Family suggests, the elder decides.",
  History: "The last 7 days, and who did what.",
  Appointments: "Doctor visits and reminders.",
  "Care circle": "Who is in this circle, and invites.",
  "Safety & AI": "Safety notes, the doctor memo and email reminders.",
};

export const CHIP: Record<string, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
  elder_confirmed: { label: "Confirmed", Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  witnessed: { label: "Witnessed", Icon: Eye, cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  skipped: { label: "Skipped", Icon: MinusCircle, cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  missed: { label: "Missed", Icon: XCircle, cls: "bg-red-50 text-red-800 ring-red-200" },
  pending: { label: "Not answered yet", Icon: Clock, cls: "bg-stone-100 text-stone-700 ring-stone-200" },
};
