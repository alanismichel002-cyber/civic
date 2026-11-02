// Netlify Function (Node): /api/summarize — FR-16 plain-language AI measure summaries.
// Enabled only when ANTHROPIC_API_KEY is set.
import Anthropic from "@anthropic-ai/sdk";
import type { Config, Context } from "@netlify/functions";
import { handleSummarize } from "../../shared/server/summarize.ts";
import { blobsKV, env } from "../lib/blobs.ts";

let client: Anthropic | undefined;

export default (req: Request, context: Context) => {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (apiKey && !client) client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  return handleSummarize(req, {
    anthropic: apiKey ? client : undefined,
    civicKey: env("GOOGLE_CIVIC_API_KEY"),
    ip: context.ip ?? "unknown",
    store: blobsKV("measure-summaries"),
  });
};

export const config: Config = { path: "/api/summarize" };
