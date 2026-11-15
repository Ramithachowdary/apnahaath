/** UI labels: sections, dose status words (never colour alone), roles and event names. */
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
  elder_confirmed: "Taken, confirmed by the older adult",
  skipped: "Skipped",
  missed: "Not confirmed",
};

export const ROLE_LABEL: Record<Role, string> = {
  elder: "Older adult",
  caretaker: "Caregiver",
  family: "Family member",
};

export const EVENT_LABEL: Record<string, string> = {
  elder_confirmed: "confirmed a dose",
  witnessed: "witnessed a dose (not counted as taken)",
  skipped: "skipped a dose",
  missed: "dose not confirmed in time",
  self_added: "recorded a medicine taken outside the schedule",
  change_proposed: "suggested a change",
  stop_proposed: "suggested stopping a medicine",
  change_accepted: "accepted a suggestion",
  change_rejected: "said no to a suggestion",
  appointment_created: "added an appointment",
  appointment_updated: "updated an appointment",
  member_joined: "joined the care circle",
};

export const TABS = ["Today", "Care plan", "Care circle", "Activity & safety"] as const;

/** Internal tabs inside a section. Every older screen is still reachable through one of these. */
export const SUBTABS: Record<string, readonly string[]> = {
  "Care plan": ["Medicines", "Appointments"],
  "Activity & safety": ["History", "Safety notes", "Doctor brief"],
};

/** Which section and internal tab each view lives under. */
export const VIEW_HOME: Record<string, { tab: (typeof TABS)[number]; sub?: string }> = {
  Today: { tab: "Today" },
  Medicines: { tab: "Care plan", sub: "Medicines" },
  Appointments: { tab: "Care plan", sub: "Appointments" },
  "Care circle": { tab: "Care circle" },
  History: { tab: "Activity & safety", sub: "History" },
  "Safety notes": { tab: "Activity & safety", sub: "Safety notes" },
  "Doctor brief": { tab: "Activity & safety", sub: "Doctor brief" },
};

export const TAB_ICON = {
  Today: CalendarCheck,
  "Care plan": Pill,
  "Care circle": Users,
  "Activity & safety": ShieldCheck,
} as const;

export const SUB_ICON: Record<string, typeof Pill> = {
  Medicines: Pill,
  Appointments: Stethoscope,
  History: HistoryIcon,
  "Safety notes": ShieldCheck,
  "Doctor brief": Stethoscope,
};

export const TAB_SUB: Record<string, string> = {
  Today: "Today's doses. Only the older adult marks a dose as taken.",
  "Care plan": "Medicines and doctor visits. Family members suggest, the older adult decides.",
  "Care circle": "Manage the people involved in daily care.",
  "Activity & safety": "Who did what, safety notes and a summary for the doctor.",
};

export const CHIP: Record<string, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
  elder_confirmed: { label: "Confirmed", Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  witnessed: { label: "Witnessed", Icon: Eye, cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  skipped: { label: "Skipped", Icon: MinusCircle, cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  missed: { label: "Not confirmed", Icon: XCircle, cls: "bg-red-50 text-red-800 ring-red-200" },
  pending: { label: "Not answered yet", Icon: Clock, cls: "bg-stone-100 text-stone-700 ring-stone-200" },
};
