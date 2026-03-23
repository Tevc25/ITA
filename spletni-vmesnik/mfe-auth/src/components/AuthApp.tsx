import { CarFront, CircleAlert, LogIn, UserPlus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { ApiClient, ApiError } from "@shared/api";
import type { AuthMfeProps } from "@shared/contracts";

import "../styles.css";

function getFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please retry.";
}

function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AuthApp({ apiBaseUrl, session, onSessionChange }: AuthMfeProps) {
  const api = useMemo(() => new ApiClient(apiBaseUrl), [apiBaseUrl]);
  const [mode, setMode] = useState<"login" | "register">("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isEmailValid(loginEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (loginPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      const nextSession = await api.buildSession(loginEmail.trim(), loginPassword);
      onSessionChange(nextSession);
      setMessage("Login successful. Redirecting to dashboard...");
      setLoginPassword("");
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (registerName.trim().length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }

    if (!isEmailValid(registerEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (registerPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.register({
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
      });
      setMode("login");
      setLoginEmail(registerEmail.trim());
      setRegisterPassword("");
      setMessage("Registration successful. You can now log in.");
    } catch (requestError) {
      setError(getFriendlyMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div>
          <h2>Smart Parking Access</h2>
          <p>Login or register to manage parking and reservations.</p>
        </div>
        <div className="auth-header-icon">
          <CarFront size={20} />
        </div>
      </div>

      {session.user ? (
        <div className="auth-session-note">
          <strong>Signed in:</strong> {session.user.name} ({session.user.email})
        </div>
      ) : null}

      <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          <LogIn size={16} /> Login
        </button>
        <button
          type="button"
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          <UserPlus size={16} /> Register
        </button>
      </div>

      {mode === "login" ? (
        <form className="auth-form" onSubmit={handleLogin}>
          <label htmlFor="auth-login-email">Email</label>
          <input
            id="auth-login-email"
            type="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />

          <label htmlFor="auth-login-password">Password</label>
          <input
            id="auth-login-password"
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            minLength={6}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleRegister}>
          <label htmlFor="auth-register-name">Name</label>
          <input
            id="auth-register-name"
            type="text"
            value={registerName}
            onChange={(event) => setRegisterName(event.target.value)}
            placeholder="Janez Novak"
            required
          />

          <label htmlFor="auth-register-email">Email</label>
          <input
            id="auth-register-email"
            type="email"
            value={registerEmail}
            onChange={(event) => setRegisterEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />

          <label htmlFor="auth-register-password">Password</label>
          <input
            id="auth-register-password"
            type="password"
            value={registerPassword}
            onChange={(event) => setRegisterPassword(event.target.value)}
            minLength={6}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
      )}

      {message ? <p className="auth-message auth-message-success">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="auth-footnote">
        <CircleAlert size={14} />
        <span>Use this module to test the users/auth backend flows through the gateway.</span>
      </div>
    </div>
  );
}
