// Netlify Function (Node): /api/reminders/* — FR-17 opt-in reminders.
// Needs REMINDER_SECRET plus RESEND_API_KEY + REMINDER_FROM_EMAIL (email) and/or TWILIO_* (SMS).
import type { Config, Context } from "@netlify/functions";
import { handleReminders } from "../../shared/server/reminders.ts";
import { blobsKV, env, siteUrl } from "../lib/blobs.ts";
import { sender } from "../lib/senders.ts";

export default (req: Request, context: Context) =>
  handleReminders(req, {
    store: blobsKV("reminders"),
    sender: sender(),
    secret: env("REMINDER_SECRET"),
    civicKey: env("GOOGLE_CIVIC_API_KEY"),
    siteUrl: siteUrl(),
    ip: context.ip ?? "unknown",
  });

export const config: Config = {
  path: ["/api/reminders/subscribe", "/api/reminders/confirm", "/api/reminders/unsubscribe"],
};
