import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./dev/apiMiddleware.ts";

export default defineConfig(({ mode }) => {
  // Loads GOOGLE_CIVIC_API_KEY from .env for the dev API only. It is not
  // prefixed with VITE_, so it is never bundled into client code.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      {
        name: "civic-dev-api",
        configureServer(server) {
          server.middlewares.use(apiMiddleware(() => env.GOOGLE_CIVIC_API_KEY));
        },
        configurePreviewServer(server) {
          server.middlewares.use(apiMiddleware(() => env.GOOGLE_CIVIC_API_KEY));
        },
      },
    ],
    build: { sourcemap: false, target: "es2020" },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    },
  };
});
