import path from "node:path";

import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "mfe_reservations",
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
  base: "/mfe-reservations/",
  server: {
    host: "0.0.0.0",
    port: 5176,
  },
  preview: {
    host: "0.0.0.0",
    port: 4176,
  },
  build: {
    target: "esnext",
  },
});
