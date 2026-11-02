// Netlify Edge Function: /api/health — used by the uptime check in .github/workflows/uptime.yml.
import type { EdgeConfig } from "../edge-types.ts";
import { handleHealth } from "../../shared/server/health.ts";

export default (req: Request) => handleHealth(req, { apiKey: Netlify.env.get("GOOGLE_CIVIC_API_KEY") });

export const config: EdgeConfig = { path: "/api/health" };
