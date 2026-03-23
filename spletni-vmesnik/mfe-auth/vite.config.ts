import path from "node:path";

import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfe_auth",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/exposed.ts",
      },
      shared: ["react", "react-dom"],
    }),
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  base: "/mfe-auth/",
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
  },
  build: {
    target: "esnext",
  },
});
