/** Static copy for the landing page: navigation, steps, roles, safety checks and FAQ. */
import {
  BellRing,
  ClipboardList,
  Eye,
  FileText,
  HandHeart,
  LockKeyhole,
  Pill,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

/** Where the landing page CTAs send people. */
export const SIGNUP_HREF = "/signup";
export const SIGNIN_HREF = "/signin";

export const NAV = [
  { href: "#how", key: "landing.how" },
  { href: "#roles", key: "landing.families" },
  { href: "#safety", key: "landing.ai" },
  { href: "#faq", key: "landing.faq" },
] as const;

export const HERO_POINTS = [
  { icon: HandHeart, text: "The older adult confirms their own medicines." },
  { icon: Eye, text: "Caregivers record doses they see being taken." },
  { icon: BellRing, text: "Family members get reminders and updates." },
  { icon: ShieldCheck, text: "Safety checks can flag possible medicine risks." },
];

export const STEPS = [
  {
    icon: UserPlus,
    title: "Create a care circle",
    text: "Create an account and add the older adult's profile.",
  },
  {
    icon: Users,
    title: "Invite family and caregivers",
    text: "Invite the people who help with daily care.",
  },
  {
    icon: Pill,
    title: "Add medicines and appointments",
    text: "Set up the schedule. The older adult reviews changes and confirms each dose.",
  },
];

export const ROLES = [
  {
    icon: HandHeart,
    who: "Older adult",
    title: "You stay in control",
    points: ["Confirm your own medicines.", "Skip a dose with a reason.", "Accept or reject suggested changes."],
  },
  {
    icon: Eye,
    who: "Caregiver",
    title: "Help with daily care",
    points: [
      "Record medicines you personally witness.",
      "View today's medication schedule.",
      "Help maintain the daily routine.",
    ],
  },
  {
    icon: Users,
    who: "Family",
    title: "Stay informed",
    points: ["Track medication updates.", "Receive reminders.", "Help manage appointments and care schedules."],
  },
];

export const CHECKS = [
  {
    icon: ShieldCheck,
    title: "Medicine safety checks",
    text: "The system can flag possible medicine interactions for review.",
  },
  {
    icon: Users,
    title: "Clear family updates",
    text: "Each person receives information relevant to their role.",
  },
  {
    icon: FileText,
    title: "Weekly care summary",
    text: "See medication activity and missed confirmations for the week.",
  },
];

export const TRUST = [
  { icon: Users, text: "Only invited members can see the care circle." },
  { icon: ClipboardList, text: "Every action is recorded under the person's name." },
  { icon: HandHeart, text: "Only the older adult can confirm their own dose." },
  { icon: LockKeyhole, text: "Reminder emails don't show medicine names in the subject." },
];

export const FACTS = [
  "Many older adults take several medicines every day.",
  "Often more than one person helps: family, a caregiver, a neighbour.",
  "Without one shared record, it is hard to know who gave what, and when.",
];

export const COMPARE: { feature: string; us: string; reminder: string; whatsapp: string }[] = [
  { feature: "The older adult confirms each dose", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Caregiver doses recorded as witnessed", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "A record nobody can quietly edit", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "One-page summary for the doctor", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Whole family sees the same record", us: "Yes", reminder: "No", whatsapp: "Partly, in chat" },
];

export const FAQ = [
  {
    q: "Who can mark a dose as taken?",
    a: "Only the older adult, from their own account. When a caregiver records a dose, it is saved as witnessed, not as taken.",
  },
  {
    q: "Can the app change a prescription?",
    a: "No. Safety checks can only warn. Anything that tries to start, stop or change a medicine is blocked. Medicine decisions stay with the doctor.",
  },
  {
    q: "Who gets the reminder emails?",
    a: "Family members get reminders for upcoming doses, missed doses and appointments. The older adult can also get a one-tap link to confirm a dose. A skipped dose is never reported as missed.",
  },
  {
    q: "Is my family's information private?",
    a: "Yes. Each care circle is separate, and only invited members can see it. Passwords are never stored in plain text.",
  },
  {
    q: "Is ApnaHaath a medical device?",
    a: "No. It is a care record, not a doctor. In an emergency, call 108 or go to the nearest hospital.",
  },
];
