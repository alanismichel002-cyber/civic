// Netlify Edge Function: /api/autocomplete
// The Google Civic API key comes from the GOOGLE_CIVIC_API_KEY environment
// variable set in the Netlify UI. It is never sent to the browser.
import type { EdgeConfig, EdgeContext } from "../edge-types.ts";
import { handleAutocomplete } from "../../shared/server/handlers.ts";

export default (req: Request, context: EdgeContext) =>
  handleAutocomplete(req, { apiKey: Netlify.env.get("GOOGLE_CIVIC_API_KEY"), ip: context.ip ?? "unknown" });

export const config: EdgeConfig = { path: "/api/autocomplete" };
