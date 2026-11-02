import { providerSender } from "../../shared/server/reminders.ts";
import { env } from "./blobs.ts";

export const sender = () =>
  providerSender({
    resendKey: env("RESEND_API_KEY"),
    fromEmail: env("REMINDER_FROM_EMAIL"),
    twilioSid: env("TWILIO_ACCOUNT_SID"),
    twilioToken: env("TWILIO_AUTH_TOKEN"),
    twilioFrom: env("TWILIO_FROM_NUMBER"),
  });
