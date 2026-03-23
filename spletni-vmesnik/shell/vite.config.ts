import path from "node:path";

import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  const authRemote =
    process.env.VITE_MFE_AUTH_REMOTE ||
    (isDev ? "http://localhost:5174/assets/remoteEntry.js" : "/mfe-auth/assets/remoteEntry.js");
  const parkingRemote =
    process.env.VITE_MFE_PARKING_REMOTE ||
    (isDev ? "http://localhost:5175/assets/remoteEntry.js" : "/mfe-parking/assets/remoteEntry.js");
  const reservationsRemote =
    process.env.VITE_MFE_RESERVATIONS_REMOTE ||
    (isDev ? "http://localhost:5176/assets/remoteEntry.js" : "/mfe-reservations/assets/remoteEntry.js");

  return {
    plugins: [
      react(),
      federation({
        name: "shell",
        remotes: {
          mfe_auth: authRemote,
          mfe_parking: parkingRemote,
          mfe_reservations: reservationsRemote,
        },
        shared: ["react", "react-dom"],
      }),
    ],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../shared/src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
    build: {
      target: "esnext",
    },
  };
});
