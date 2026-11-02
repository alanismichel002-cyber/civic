import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./dev/apiMiddleware.ts";

export default defineConfig(({ mode }) => {
  // Loads server keys from .env for the dev API only. They are not prefixed
  // with VITE_, so they are never bundled into client code.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      {
        name: "civic-dev-api",
        configureServer(server) {
          server.middlewares.use(apiMiddleware(() => env));
        },
        configurePreviewServer(server) {
          server.middlewares.use(apiMiddleware(() => env));
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
