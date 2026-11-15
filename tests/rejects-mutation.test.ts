import { describe, expect, it } from "vitest";
import { rejectsMutation } from "../src/lib/gemini";

const forbidden: Array<[string, string]> = [
  ["stop taking", "Please stop taking Telma this week."],
  ["start taking", "Start taking an extra tablet at night."],
  ["quit taking", "Quit taking Shelcal until the swelling goes down."],
  ["resume taking", "Resume taking Ecosprin tomorrow morning."],
  ["restart taking", "Restart taking Thyronorm at a higher strength."],
  ["pause taking", "Pause taking Glycomet if her sugar is low."],
  ["stop using", "Stop using this pain gel and the tablet together."],
  ["start giving", "Start giving her two pills of Brufen after food."],
  ["discontinue", "Discontinue Ecosprin for now."],
  ["discontinued", "This medicine should be discontinued today."],
  ["discontinuing", "We are discontinuing the evening tablet."],
  ["hold medicine", "Hold this medicine until Monday."],
  ["withhold tablet", "Withhold the tablet if sugar is low."],
  ["pause dose", "Pause the dose tonight and see how she feels."],
  ["suspend medication", "Suspend the medication until the doctor calls."],
  ["do not take it", "Do not take it with dinner."],
  ["don't take this", "Don't take this tablet tonight."],
  ["dont give her", "Dont give her the night dose."],
  ["never take any", "Never take any of these pills on an empty stomach, just skip them."],
  ["skip your dose", "Skip your dose of Shelcal today."],
  ["skip her tablet", "Skip her tablet this evening."],
  ["skip the medicine", "Skip the medicine until we hear from the clinic."],
  ["skip next dose", "Skip next dose if she already ate late."],
  ["skip today's dose", "Skip today's dose of Thyronorm."],
  ["skip tonight's dose", "Skip tonight's dose and rest."],
  ["reduce dose", "Reduce the dose of Telma from tomorrow."],
  ["halve dosage", "Halve the dosage of Glycomet."],
  ["cut down tablets", "Cut down the tablets to one a day."],
  ["taper dose", "Taper the dose over a week."],
  ["double pills", "Double the pills on days she walks more."],
  ["triple mg", "Triple the mg if pain continues."],
  ["switch to", "Switch to paracetamol instead of Brufen."],
  ["switch from", "Switch from Telma to a different blood-pressure tablet."],
  ["instead of medicine", "Use this herb instead of your medicine."],
  ["in place of tablet", "Take this powder in place of the tablet."],
  ["increase the dose", "Increase the dose to 80 mg."],
  ["decrease her dosage", "Decrease her dosage after lunch."],
  ["change the dose", "Change the dose tonight."],
  ["adjust your dose", "Adjust your dose based on the reading."],
  ["dose to", "Raise the dose to 50 mg."],
  ["dose up", "The doctor may want the dose up, so do it today."],
  ["dosage decrease", "Ask us to mark a dosage decrease in the log."],
  ["replace with", "Replace with a stronger painkiller."],
  ["double the dose", "Double the dose tomorrow."],
  ["half dose", "Give a half dose this evening."],
  ["skip dose", "Just skip the dose if she is asleep."],
  ["take 50 mg", "Take 50 mg of Telma now."],
  ["take 1.5 tablets", "Take 1.5 tablets after food."],
  ["take one tablet", "Take one tablet of Brufen now."],
  ["take two pills", "Take two pills before bed."],
  ["take an extra dose", "Take an extra dose if the pain returns."],
  ["take another tablet", "Take another tablet at 4 PM."],
  ["hinglish dawai band", "Please dawai band karo until Monday."],
  ["hinglish dose badal", "Doctor ke bina dose badal mat, wait, actually dose badal do."],
  ["hinglish band karo", "Yeh dawai band karo abhi."],
  ["hinglish band karein", "Subah wali tablet band karein."],
  ["hinglish band kardein", "Family se keh dena dawai band kardein."],
  ["hinglish band karde", "Raat ki dawai band karde."],
];

const allowed: Array<[string, string]> = [
  ["bleeding risk", "Brufen with Ecosprin can increase the risk of stomach bleeding; she took 400 mg today."],
  ["don't double missed", "Do not double the dose to make up for a missed one."],
  ["don't stop without doctor", "Do not stop or change any medicine without asking the doctor."],
  ["tell the doctor", "Tell Dr. Sharma about the knee pain and the Brufen."],
  ["logged dose", "Kamla has lower back pain and took Brufen 400 mg."],
  ["upcoming reminder", "Kamla Devi has Thyronorm due at 8:00 AM IST. Only she can mark it as taken."],
  ["confirm as prescribed", "Please take Thyronorm at 8:00 AM as prescribed by the doctor."],
  ["missed check-in", "Tell the family if a dose was not confirmed after 90 minutes."],
  ["never adjust unless doctor", "Never adjust the dose unless the doctor asks you to."],
  ["don't take a double dose", "Don't take a double dose."],
  ["appointment reminder", "Dr Mehta at KGMU — 2026-11-20 2:30 PM IST. Carry previous reports."],
  ["hindi take on time", "Dawai time pe lijiye aur doctor se baat kijiye."],
  ["hindi confirm", "Aaj ki dawai confirm kar dijiye. Kuch mat badaliye."],
  ["food instruction", "Take Shelcal after food, at the usual time written on the box."],
  ["water", "Sip water with the morning tablet as the doctor already advised."],
  ["empty warn-only", "No prescription or dose was changed by ApnaHaath."],
];

describe("rejectsMutation forbidden phrasings", () => {
  it.each(forbidden)("%s", (_label, text) => {
    expect(rejectsMutation(text), text).toBe(true);
  });
});

describe("rejectsMutation allowed warn-only advice", () => {
  it.each(allowed)("%s", (_label, text) => {
    expect(rejectsMutation(text), text).toBe(false);
  });
});
