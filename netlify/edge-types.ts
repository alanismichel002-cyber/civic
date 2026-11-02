// Minimal typings for the Netlify Edge runtime (Deno) used by our functions.
// Kept as a plain .ts module so it bundles cleanly under Deno.

declare global {
  // eslint-disable-next-line no-var
  var Netlify: { env: { get(name: string): string | undefined } };
}

export interface EdgeContext {
  ip: string;
}

export interface EdgeConfig {
  path: string | string[];
  method?: string | string[];
  cache?: "manual";
}
