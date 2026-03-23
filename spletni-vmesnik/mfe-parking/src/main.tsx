import React from "react";
import ReactDOM from "react-dom/client";

import { EMPTY_SESSION } from "@shared/session";

import ParkingApp from "./components/ParkingApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="standalone-parking-shell">
      <ParkingApp
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL || "/api/web"}
        session={EMPTY_SESSION}
        onReserveLot={(lot) => {
          // Standalone mode demo.
          console.info("Reserve requested", lot);
        }}
      />
    </div>
  </React.StrictMode>,
);
