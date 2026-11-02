// Netlify Function (Node): /api/representatives — FR-18 Who Represents Me.
import type { Config, Context } from "@netlify/functions";
import { handleRepresentatives } from "../../shared/server/representatives.ts";
import { env } from "../lib/blobs.ts";

export default (req: Request, context: Context) =>
  handleRepresentatives(req, {
    googleKey: env("GOOGLE_CIVIC_API_KEY"),
    openStatesKey: env("OPENSTATES_API_KEY"),
    ip: context.ip ?? "unknown",
  });

export const config: Config = { path: "/api/representatives" };
