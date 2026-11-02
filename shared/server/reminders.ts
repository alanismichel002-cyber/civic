// FR-17: opt-in email / SMS reminders.
//
// Privacy: we store only what's needed to send the reminder: the contact (email or phone), language,
// the election, key dates, and the *public* polling place. Never the voter's home address.
// Every message has a one-tap unsubscribe link; unsubscribing deletes the record.
// Double opt-in: nothing is sent except the confirmation until the voter confirms.

import { sha256 } from "./cache.ts";
import { errorResponse, json, lookupVoterInfo, validateAddress, validateElectionId } from "./handlers.ts";
import type { KV } from "./kv.ts";
import { RateLimiter } from "./rateLimit.ts";

export type Channel = "email" | "sms";
export type Lang = "en" | "es";
export type ReminderKind = "early" | "eve" | "day";

export interface Subscription {
  key: string;
  channel: Channel;
  contact: string;
  lang: Lang;
  electionId: string;
  electionName: string;
  electionDay: string;
  earlyStart?: string;
  pollingPlace?: string;
  pollingHours?: string;
  confirmed: boolean;
  createdAt: string;
  sent: ReminderKind[];
}

export interface Sender {
  email?: (to: string, subject: string, text: string, unsubscribeUrl: string) => Promise<void>;
  sms?: (to: string, body: string) => Promise<void>;
}

export interface RemindersEnv {
  store: KV;
  sender: Sender;
  secret: string | undefined;
  civicKey: string | undefined;
  siteUrl: string;
  ip: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

const limiter = new RateLimiter(5, 60_000);
export function __resetRemindersForTests() {
  Object.assign(limiter, new RateLimiter(5, 60_000));
}

// ---------------------------------------------------------------- validation

const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

export function normalizeEmail(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const e = v.trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : undefined;
}

/** U.S. numbers only, normalized to E.164 (+1XXXXXXXXXX). */
export function normalizePhone(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  let d = v.replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return undefined;
  return `+1${d}`;
}

// ---------------------------------------------------------------- signed tokens

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): string {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}

export async function makeToken(secret: string, purpose: "confirm" | "unsub", key: string): Promise<string> {
  const payload = b64url(new TextEncoder().encode(`${purpose}|${key}`));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function readToken(secret: string, purpose: "confirm" | "unsub", token: string): Promise<string | undefined> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || token.length > 600) return undefined;
  const expected = await hmac(secret, payload);
  // Constant-time-ish compare.
  if (expected.length !== sig.length) return undefined;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return undefined;
  try {
    const [p, key] = fromB64url(payload).split("|");
    return p === purpose && key?.startsWith("sub/") ? key : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- messages

const fmtDay = (day: string, lang: Lang) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
};

export function buildMessage(sub: Subscription, kind: ReminderKind | "confirm", link: string, unsubscribeUrl: string) {
  const es = sub.lang === "es";
  const when = fmtDay(sub.electionDay, sub.lang);
  const where = sub.pollingPlace
    ? es
      ? `Su centro de votación: ${sub.pollingPlace}${sub.pollingHours ? ` (${sub.pollingHours})` : ""}.`
      : `Your polling place: ${sub.pollingPlace}${sub.pollingHours ? ` (${sub.pollingHours})` : ""}.`
    : "";
  const stop = es ? `Cancelar: ${unsubscribeUrl}` : `Unsubscribe: ${unsubscribeUrl}`;
  let subject: string;
  let lines: string[];
  switch (kind) {
    case "confirm":
      subject = es ? "Confirme sus recordatorios de votación" : "Confirm your voting reminders";
      lines = es
        ? [`Confirme que quiere recordatorios para ${sub.electionName} (${when}):`, link, "Si no los pidió, ignore este mensaje."]
        : [`Confirm you'd like reminders for ${sub.electionName} (${when}):`, link, "If you didn't ask for this, ignore this message."];
      break;
    case "early":
      subject = es ? "Hoy empieza la votación anticipada" : "Early voting starts today";
      lines = es
        ? [`Hoy empieza la votación anticipada para ${sub.electionName}.`, `Vea su plan: ${link}`]
        : [`Early voting for ${sub.electionName} starts today.`, `See your plan: ${link}`];
      break;
    case "eve":
      subject = es ? "Mañana es el día de la elección" : "Election Day is tomorrow";
      lines = es
        ? [`Mañana, ${when}, es ${sub.electionName}.`, where, `Vea su plan y su boleta: ${link}`]
        : [`Tomorrow, ${when}, is ${sub.electionName}.`, where, `See your plan and ballot: ${link}`];
      break;
    case "day":
      subject = es ? "Hoy es el día de la elección" : "Today is Election Day";
      lines = es
        ? [`Hoy es ${sub.electionName}.`, where, `Vea su plan: ${link}`]
        : [`Today is ${sub.electionName}.`, where, `See your plan: ${link}`];
      break;
  }
  const text = [...lines.filter(Boolean), "", "Civic", stop].join("\n");
  const sms = `Civic: ${lines.filter(Boolean).join(" ")} ${es ? "Responda STOP para cancelar." : "Reply STOP to opt out."}`;
  return { subject, text, sms };
}

async function deliver(env: Pick<RemindersEnv, "sender">, sub: Subscription, msg: ReturnType<typeof buildMessage>, unsub: string) {
  if (sub.channel === "email") {
    if (!env.sender.email) throw new Error("email not configured");
    await env.sender.email(sub.contact, msg.subject, msg.text, unsub);
  } else {
    if (!env.sender.sms) throw new Error("sms not configured");
    await env.sender.sms(sub.contact, msg.sms);
  }
}

// ---------------------------------------------------------------- HTTP handlers

function htmlPage(title: string, body: string, status = 200) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
      title,
    )}</title><style>body{font:18px/1.5 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#0f172a}a{color:#1e40af}</style></head><body><h1>${esc(
      title,
    )}</h1><p>${esc(body)}</p><p><a href="/">Civic</a></p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}

export function remindersEnabled(env: Pick<RemindersEnv, "sender" | "secret">) {
  return { email: !!(env.secret && env.sender.email), sms: !!(env.secret && env.sender.sms) };
}

export async function handleReminders(req: Request, env: RemindersEnv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (!env.secret) return errorResponse("feature_disabled", "Reminders are not enabled on this site.", 501);

  if (path.endsWith("/subscribe")) return subscribe(req, env);

  if (path.endsWith("/confirm")) {
    const key = await readToken(env.secret, "confirm", url.searchParams.get("token") ?? "");
    const sub = key ? await env.store.get<Subscription>(key) : undefined;
    if (!sub) return htmlPage("Link expired", "This confirmation link is invalid or has expired. Please sign up again.", 404);
    sub.confirmed = true;
    await env.store.set(sub.key, sub);
    return sub.lang === "es"
      ? htmlPage("¡Listo!", `Le enviaremos recordatorios para ${sub.electionName}. Puede cancelar en cualquier momento.`)
      : htmlPage("You're all set", `We'll send you reminders for ${sub.electionName}. You can unsubscribe at any time.`);
  }

  if (path.endsWith("/unsubscribe")) {
    // GET (link) and POST (RFC 8058 one-click from mail clients) both unsubscribe immediately.
    const key = await readToken(env.secret, "unsub", url.searchParams.get("token") ?? "");
    if (key) await env.store.delete(key);
    if (req.method === "POST") return new Response(null, { status: 204 });
    return htmlPage("Unsubscribed", "You won't get any more reminders from Civic. Your contact information has been deleted.");
  }

  return errorResponse("not_found", "Not found.", 404);
}

async function subscribe(req: Request, env: RemindersEnv): Promise<Response> {
  if (req.method !== "POST") return errorResponse("bad_request", "Use POST.", 405, { allow: "POST" });
  const wait = limiter.check(env.ip);
  if (wait) return errorResponse("rate_limited", "Too many requests. Please wait a moment.", 429, { "retry-after": String(wait) });
  if (!env.civicKey) return errorResponse("not_configured", "The server is missing its API key.", 500);

  let body: Record<string, unknown> | undefined;
  try {
    const text = await req.text();
    body = text.length <= 4096 ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  const channel: Channel = body?.channel === "sms" ? "sms" : "email";
  const enabled = remindersEnabled(env);
  if (!enabled[channel]) return errorResponse("feature_disabled", `${channel === "sms" ? "Text" : "Email"} reminders are not enabled.`, 501);
  if (body?.consent !== true) return errorResponse("bad_request", "Please agree to receive reminders.", 400);
  const contact = channel === "email" ? normalizeEmail(body?.contact) : normalizePhone(body?.contact);
  if (!contact) {
    return errorResponse("bad_request", channel === "email" ? "Enter a valid email address." : "Enter a valid U.S. mobile number.", 400);
  }
  const address = validateAddress(body?.address);
  const electionId = validateElectionId(body?.electionId);
  if (!address || !electionId) return errorResponse("bad_request", "Invalid request.", 400);
  const lang: Lang = body?.lang === "es" ? "es" : "en";

  // Look up the plan now so reminders can include the polling place. The home address is used
  // only for this lookup and is not stored.
  const lookup = await lookupVoterInfo(address, electionId, env.civicKey, env.fetch ?? fetch);
  if (!lookup.ok) return lookup.response;
  const info = lookup.info;
  const today = (env.now?.() ?? new Date()).toISOString().slice(0, 10);
  if (!info.election.day || info.election.day < today) return errorResponse("bad_request", "This election has already passed.", 400);

  const polling = info.pollingLocations[0];
  const pollingPlace = polling
    ? [polling.name, [polling.address.line1, polling.address.city, polling.address.state].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(", ")
    : undefined;
  const earlyStart = info.earlyVoteSites
    .map((s) => s.startDate)
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0];

  // One subscription per contact per election; signing up again just refreshes it.
  const key = `sub/${info.election.id}/${await sha256(`${channel}|${contact}`)}`;
  const existing = await env.store.get<Subscription>(key);
  const sub: Subscription = {
    key,
    channel,
    contact,
    lang,
    electionId: info.election.id,
    electionName: info.election.name,
    electionDay: info.election.day,
    earlyStart: earlyStart && earlyStart >= today ? earlyStart : undefined,
    pollingPlace,
    pollingHours: polling?.hours?.split("\n").slice(-1)[0],
    confirmed: existing?.confirmed ?? false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    sent: existing?.sent ?? [],
  };
  await env.store.set(key, sub);

  if (!sub.confirmed) {
    const confirmUrl = `${env.siteUrl}/api/reminders/confirm?token=${await makeToken(env.secret!, "confirm", key)}`;
    const unsub = `${env.siteUrl}/api/reminders/unsubscribe?token=${await makeToken(env.secret!, "unsub", key)}`;
    try {
      await deliver(env, sub, buildMessage(sub, "confirm", confirmUrl, unsub), unsub);
    } catch {
      console.error(`[reminders] confirmation send failed (${channel})`);
      await env.store.delete(key);
      return errorResponse("upstream_error", "We couldn't send the confirmation. Please check it and try again.", 502);
    }
  }
  return json({ ok: true, needsConfirmation: !sub.confirmed, channel });
}

// ---------------------------------------------------------------- scheduled sender

/** Which reminder, if any, is due today for a subscription. */
export function dueReminder(sub: Subscription, today: string): ReminderKind | undefined {
  const eve = (() => {
    const [y, m, d] = sub.electionDay.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  })();
  if (today === sub.electionDay && !sub.sent.includes("day")) return "day";
  if (today === eve && !sub.sent.includes("eve")) return "eve";
  if (sub.earlyStart && today === sub.earlyStart && !sub.sent.includes("early")) return "early";
  return undefined;
}

/** Today's date in U.S. Eastern time (reminders go out in the U.S. morning). */
export function easternToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function sendDueReminders(env: Pick<RemindersEnv, "store" | "sender" | "secret" | "siteUrl" | "now">) {
  const today = easternToday(env.now?.() ?? new Date());
  const keys = await env.store.list("sub/");
  const stats = { checked: keys.length, sent: 0, failed: 0, deleted: 0 };
  for (const key of keys) {
    const sub = await env.store.get<Subscription>(key);
    if (!sub) continue;
    // Clean up: unconfirmed after 3 days, and everything once the election has passed.
    const ageDays = (Date.now() - Date.parse(sub.createdAt)) / 86_400_000;
    if (sub.electionDay < today || (!sub.confirmed && ageDays > 3)) {
      await env.store.delete(key);
      stats.deleted++;
      continue;
    }
    if (!sub.confirmed) continue;
    const kind = dueReminder(sub, today);
    if (!kind || !env.secret) continue;
    const unsub = `${env.siteUrl}/api/reminders/unsubscribe?token=${await makeToken(env.secret, "unsub", key)}`;
    try {
      await deliver(env, sub, buildMessage(sub, kind, `${env.siteUrl}/`, unsub), unsub);
      sub.sent.push(kind);
      await env.store.set(key, sub);
      stats.sent++;
    } catch {
      stats.failed++;
    }
  }
  console.log(`[reminders] ${JSON.stringify(stats)}`);
  return stats;
}

// ---------------------------------------------------------------- providers

/** Resend (email) and Twilio (SMS) senders, enabled by environment variables. */
export function providerSender(e: {
  resendKey?: string;
  fromEmail?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  fetch?: typeof fetch;
}): Sender {
  const f = e.fetch ?? fetch;
  const sender: Sender = {};
  if (e.resendKey && e.fromEmail) {
    sender.email = async (to, subject, text, unsubscribeUrl) => {
      const res = await f("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${e.resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: e.fromEmail,
          to: [to],
          subject,
          text,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`resend ${res.status}`);
    };
  }
  if (e.twilioSid && e.twilioToken && e.twilioFrom) {
    sender.sms = async (to, body) => {
      const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.twilioSid!)}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${e.twilioSid}:${e.twilioToken}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: e.twilioFrom!, Body: body }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`twilio ${res.status}`);
    };
  }
  return sender;
}
