import React from "react";
import ReactDOM from "react-dom/client";

import { EMPTY_SESSION } from "@shared/session";

import AuthApp from "./components/AuthApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="standalone-auth-shell">
      <AuthApp
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL || "/api/web"}
        session={EMPTY_SESSION}
        onSessionChange={() => {
          // Standalone mode: no-op.
        }}
      />
    </div>
  </React.StrictMode>,
);
