// Scheduled Netlify Function: sends due reminders once a day (14:17 UTC ≈ 9–10 AM U.S. Eastern).
import type { Config } from "@netlify/functions";
import { sendDueReminders } from "../../shared/server/reminders.ts";
import { blobsKV, env, siteUrl } from "../lib/blobs.ts";
import { sender } from "../lib/senders.ts";

export default async () => {
  if (!env("REMINDER_SECRET")) return;
  await sendDueReminders({ store: blobsKV("reminders"), sender: sender(), secret: env("REMINDER_SECRET"), siteUrl: siteUrl() });
};

export const config: Config = { schedule: "17 14 * * *" };
