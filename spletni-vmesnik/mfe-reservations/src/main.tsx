import React from "react";
import ReactDOM from "react-dom/client";

import { EMPTY_SESSION } from "@shared/session";

import ReservationsApp from "./components/ReservationsApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="standalone-res-shell">
      <ReservationsApp
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL || "/api/web"}
        session={EMPTY_SESSION}
        selectedLot={null}
      />
    </div>
  </React.StrictMode>,
);
