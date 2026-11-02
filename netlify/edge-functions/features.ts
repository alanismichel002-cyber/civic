// Netlify Edge Function: /api/features — which optional features are configured.
import type { EdgeConfig } from "../edge-types.ts";
import { handleFeatures } from "../../shared/server/features.ts";

export default () => handleFeatures((n) => Netlify.env.get(n));

export const config: EdgeConfig = { path: "/api/features" };
