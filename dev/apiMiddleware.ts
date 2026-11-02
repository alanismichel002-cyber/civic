// Vite dev-server middleware that runs the same handlers as the Netlify Edge Functions and
// Functions, so `npm run dev` works without the Netlify CLI. Blobs are replaced by memory.
import type { Connect } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import { handleAutocomplete, handleElections, handleVoterInfo } from "../shared/server/handlers.ts";
import { handleRepresentatives } from "../shared/server/representatives.ts";
import { handleSummarize } from "../shared/server/summarize.ts";
import { handleReminders, providerSender } from "../shared/server/reminders.ts";
import { handleHealth } from "../shared/server/health.ts";
import { handleFeatures } from "../shared/server/features.ts";
import { MemoryKV } from "../shared/server/kv.ts";

type Env = Record<string, string | undefined>;
type Handler = (req: Request, ip: string) => Promise<Response> | Response;

export function apiMiddleware(getEnv: () => Env): Connect.NextHandleFunction {
  const summaries = new MemoryKV();
  const reminders = new MemoryKV();
  let anthropic: Anthropic | undefined;

  const routes: Record<string, Handler> = {
    "/api/voterinfo": (req, ip) => handleVoterInfo(req, { apiKey: getEnv().GOOGLE_CIVIC_API_KEY, ip }),
    "/api/elections": (req, ip) => handleElections(req, { apiKey: getEnv().GOOGLE_CIVIC_API_KEY, ip }),
    "/api/autocomplete": (req, ip) => handleAutocomplete(req, { apiKey: getEnv().GOOGLE_CIVIC_API_KEY, ip }),
    "/api/health": (req) => handleHealth(req, { apiKey: getEnv().GOOGLE_CIVIC_API_KEY }),
    "/api/features": () => handleFeatures((n) => getEnv()[n]),
    "/api/representatives": (req, ip) =>
      handleRepresentatives(req, { googleKey: getEnv().GOOGLE_CIVIC_API_KEY, openStatesKey: getEnv().OPENSTATES_API_KEY, ip }),
    "/api/summarize": (req, ip) => {
      const key = getEnv().ANTHROPIC_API_KEY;
      if (key && !anthropic) anthropic = new Anthropic({ apiKey: key });
      return handleSummarize(req, { anthropic: key ? anthropic : undefined, civicKey: getEnv().GOOGLE_CIVIC_API_KEY, ip, store: summaries });
    },
  };
  const remindersHandler: Handler = (req, ip) => {
    const e = getEnv();
    return handleReminders(req, {
      store: reminders,
      sender: providerSender({
        resendKey: e.RESEND_API_KEY,
        fromEmail: e.REMINDER_FROM_EMAIL,
        twilioSid: e.TWILIO_ACCOUNT_SID,
        twilioToken: e.TWILIO_AUTH_TOKEN,
        twilioFrom: e.TWILIO_FROM_NUMBER,
      }),
      secret: e.REMINDER_SECRET,
      civicKey: e.GOOGLE_CIVIC_API_KEY,
      siteUrl: "http://localhost:5173",
      ip,
    });
  };

  return async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    const handler = routes[path] ?? (path.startsWith("/api/reminders/") ? remindersHandler : undefined);
    if (!handler) return next();

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const response = await handler(request, req.socket.remoteAddress ?? "local");
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
