// /api/features: tells the UI which optional features have their keys configured.
// Booleans only; never reveals key values.
import { json } from "./handlers.ts";

export interface Features {
  summaries: boolean;
  reminders: { email: boolean; sms: boolean };
  stateLegislators: boolean;
}

export function features(get: (name: string) => string | undefined): Features {
  const has = (n: string) => !!get(n)?.trim();
  const secret = has("REMINDER_SECRET");
  return {
    summaries: has("ANTHROPIC_API_KEY"),
    reminders: {
      email: secret && has("RESEND_API_KEY") && has("REMINDER_FROM_EMAIL"),
      sms: secret && has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_FROM_NUMBER"),
    },
    stateLegislators: has("OPENSTATES_API_KEY"),
  };
}

export function handleFeatures(get: (name: string) => string | undefined): Response {
  return json(features(get), 200, { "cache-control": "public, max-age=60" });
}
