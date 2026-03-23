import { Activity, CarFront, ChevronRight, LogOut, PlusSquare, ShieldCheck } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import { ApiClient } from "@shared/api";
import { clearSession, EMPTY_SESSION, loadSession, saveSession } from "@shared/session";
import type { ParkingLot, SessionState, SystemServiceStatus } from "@shared/types";

const AuthMfe = lazy(() => import("mfe_auth/App"));
const ParkingMfe = lazy(() => import("mfe_parking/App"));
const ReservationsMfe = lazy(() => import("mfe_reservations/App"));

type AppView = "dashboard" | "parking-create" | "reservations" | "lab";

function MfeLoading({ label }: { label: string }) {
  return (
    <div className="mfe-loading">
      <span className="loading-dot" /> Loading {label}...
    </div>
  );
}

function HealthBadge({ healthy }: { healthy: boolean | null }) {
  if (healthy === null) {
    return <span className="health-badge pending">Checking</span>;
  }

  return healthy ? (
    <span className="health-badge ok">Gateway online</span>
  ) : (
    <span className="health-badge error">Gateway unreachable</span>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession());
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [labOutput, setLabOutput] = useState("API lab output appears here.");
  const [systemServices, setSystemServices] = useState<SystemServiceStatus[] | null>(null);
  const [systemGeneratedAt, setSystemGeneratedAt] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/web";
  const healthPath = import.meta.env.VITE_HEALTH_PATH || "/health";
  const api = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl]);

  useEffect(() => {
    async function runHealthCheck() {
      try {
        const health = await api.health(healthPath);
        setHealthy(health.status === "ok");
      } catch {
        setHealthy(false);
      }
    }

    runHealthCheck();
  }, [api, healthPath]);

  function handleSessionChange(next: SessionState) {
    setSession(next);
    saveSession(next);
  }

  function handleLogout() {
    clearSession();
    setSession(EMPTY_SESSION);
    setSelectedLot(null);
    setActiveView("dashboard");
  }

  async function runLabHealth() {
    try {
      const result = await api.health(healthPath);
      setLabOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setLabOutput(error instanceof Error ? error.message : "Health request failed.");
    }
  }

  async function runLabMe() {
    if (!session.token) {
      setLabOutput("Login first to call /me.");
      return;
    }

    try {
      const me = await api.me(session.token);
      setLabOutput(JSON.stringify(me, null, 2));
    } catch (error) {
      setLabOutput(error instanceof Error ? error.message : "Could not fetch /me.");
    }
  }

  async function runLabSystemStatus() {
    try {
      const result = await api.systemStatus();
      setSystemServices(result.services);
      setSystemGeneratedAt(result.generated_at);
      setLabOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setLabOutput(error instanceof Error ? error.message : "Could not fetch system status.");
    }
  }

  return (
    <div className="shell-app">
      <header className="shell-header">
        <div className="brand-block">
          <div className="brand-icon">
            <CarFront size={20} />
          </div>
          <div>
            <h1>ITA Smart Parking Platform</h1>
            <p>Micro Frontends shell for users, parking, reservations, and API testing.</p>
          </div>
        </div>

        <div className="header-actions">
          <HealthBadge healthy={healthy} />
          {session.user ? (
            <div className="user-chip">
              <ShieldCheck size={15} />
              <span>{session.user.name}</span>
            </div>
          ) : null}
          {session.user ? (
            <button type="button" className="logout-btn" onClick={handleLogout}>
              <LogOut size={15} /> Logout
            </button>
          ) : null}
        </div>
      </header>

      {!session.user ? (
        <main className="auth-layout">
          <section className="auth-hero">
            <h2>Mobility-first parking operations</h2>
            <p>
              Use the auth micro frontend to register and sign in. After login you can access parking map operations,
              reservation workflows, and developer endpoint testing tools.
            </p>
            <ul>
              <li>
                <ChevronRight size={14} /> Auth via users service through `gateway-web`
              </li>
              <li>
                <ChevronRight size={14} /> Parking map with availability indicators
              </li>
              <li>
                <ChevronRight size={14} /> Reservation create/list/cancel flows
              </li>
            </ul>
          </section>

          <section>
            <Suspense fallback={<MfeLoading label="auth module" />}>
              <AuthMfe apiBaseUrl={apiBaseUrl} session={session} onSessionChange={handleSessionChange} />
            </Suspense>
          </section>
        </main>
      ) : (
        <main className="shell-content">
          <nav className="shell-nav" aria-label="Main views">
            <button
              type="button"
              className={activeView === "dashboard" ? "active" : ""}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={activeView === "reservations" ? "active" : ""}
              onClick={() => setActiveView("reservations")}
            >
              My Reservations
            </button>
            <button
              type="button"
              className={activeView === "parking-create" ? "active" : ""}
              onClick={() => setActiveView("parking-create")}
            >
              <PlusSquare size={14} /> Create Parking
            </button>
            <button type="button" className={activeView === "lab" ? "active" : ""} onClick={() => setActiveView("lab")}>
              API Lab
            </button>
          </nav>

          <section className="shell-view-panel">
            {activeView === "dashboard" ? (
              <Suspense fallback={<MfeLoading label="parking module" />}>
                <ParkingMfe
                  apiBaseUrl={apiBaseUrl}
                  session={session}
                  onReserveLot={(lot) => {
                    setSelectedLot(lot);
                    setActiveView("reservations");
                  }}
                />
              </Suspense>
            ) : null}

            {activeView === "reservations" ? (
              <Suspense fallback={<MfeLoading label="reservations module" />}>
                <ReservationsMfe apiBaseUrl={apiBaseUrl} session={session} selectedLot={selectedLot} />
              </Suspense>
            ) : null}

            {activeView === "parking-create" ? (
              <Suspense fallback={<MfeLoading label="parking create module" />}>
                <ParkingMfe
                  apiBaseUrl={apiBaseUrl}
                  session={session}
                  mode="create"
                  onReserveLot={(lot) => {
                    setSelectedLot(lot);
                    setActiveView("reservations");
                  }}
                />
              </Suspense>
            ) : null}

            {activeView === "lab" ? (
              <div className="api-lab-card">
                <h2>
                  <Activity size={18} /> Gateway API Lab
                </h2>
                <p>
                  This panel helps test direct gateway actions in addition to the dedicated MFE modules.
                </p>

                <div className="api-lab-actions">
                  <button type="button" onClick={runLabHealth}>
                    Check /health
                  </button>
                  <button type="button" onClick={runLabMe}>
                    Check /api/web/me
                  </button>
                  <button type="button" onClick={runLabSystemStatus}>
                    Check /api/web/system/status
                  </button>
                </div>

                <textarea className="api-lab-output" value={labOutput} readOnly />

                {systemServices ? (
                  <div className="system-status-panel">
                    <div className="system-status-head">
                      <h3>System Status</h3>
                      {systemGeneratedAt ? <span>Updated: {new Date(systemGeneratedAt).toLocaleString()}</span> : null}
                    </div>

                    <div className="system-status-grid">
                      {systemServices.map((item) => (
                        <article key={item.service} className={`system-status-item ${item.up ? "up" : "down"}`}>
                          <strong>{item.service}</strong>
                          <span>{item.up ? "UP" : "DOWN"}</span>
                          <small>
                            HTTP: {item.status_code ?? "-"} | Latency: {item.latency_ms ?? "-"} ms
                          </small>
                          <small>Circuit: {item.circuit_breaker?.state || "n/a"}</small>
                          {item.detail ? <small>{item.detail}</small> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </main>
      )}
    </div>
  );
}
