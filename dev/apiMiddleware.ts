// Vite dev-server middleware that runs the same handlers as the Netlify Edge
// Functions, so `npm run dev` works without the Netlify CLI.
import type { Connect } from "vite";
import { handleAutocomplete, handleElections, handleVoterInfo } from "../shared/server/handlers.ts";

const routes = {
  "/api/voterinfo": handleVoterInfo,
  "/api/elections": handleElections,
  "/api/autocomplete": handleAutocomplete,
} as const;

export function apiMiddleware(getKey: () => string | undefined): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0] as keyof typeof routes;
    const handler = routes[path];
    if (!handler) return next();

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const response = await handler(request, { apiKey: getKey(), ip: req.socket.remoteAddress ?? "local" });
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
