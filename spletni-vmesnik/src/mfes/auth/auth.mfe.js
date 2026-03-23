import { prettyJson, apiRequest } from "../../shared/http.js";

function setMessage(target, text, isError = false) {
  target.textContent = text || "";
  target.className = isError ? "message message-error" : "message message-ok";
}

function setOutput(target, payload) {
  target.value = prettyJson(payload);
}

function currentAuthState(bridge) {
  const { token, currentUser } = bridge.getState();
  if (!token) {
    return "not authenticated";
  }
  if (!currentUser) {
    return "token available, profile not loaded";
  }
  return `authenticated as ${currentUser.email}`;
}

export function mountAuthMfe(rootElement, bridge) {
  rootElement.innerHTML = `
    <div class="mfe-header">
      <h2 class="mfe-title">Auth MFE</h2>
      <small id="auth-state">not authenticated</small>
    </div>

    <div class="mfe-section">
      <h3>Register</h3>
      <form id="auth-register-form">
        <label for="auth-register-name">Name</label>
        <input id="auth-register-name" name="name" type="text" required />

        <label for="auth-register-email">Email</label>
        <input id="auth-register-email" name="email" type="email" required />

        <label for="auth-register-password">Password</label>
        <input id="auth-register-password" name="password" type="password" minlength="6" required />

        <button type="submit">Register user</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Login + session</h3>
      <form id="auth-login-form">
        <label for="auth-login-email">Email</label>
        <input id="auth-login-email" name="email" type="email" required />

        <label for="auth-login-password">Password</label>
        <input id="auth-login-password" name="password" type="password" required />

        <button type="submit">Login</button>
      </form>

      <div class="inline-buttons">
        <button id="auth-load-me" class="secondary" type="button">Load /me</button>
        <button id="auth-logout" class="secondary" type="button">Logout</button>
      </div>
    </div>

    <p id="auth-message" class="message"></p>
    <textarea id="auth-output" class="mono-box" readonly aria-label="auth result"></textarea>
  `;

  const messageEl = rootElement.querySelector("#auth-message");
  const outputEl = rootElement.querySelector("#auth-output");
  const authStateEl = rootElement.querySelector("#auth-state");

  const registerForm = rootElement.querySelector("#auth-register-form");
  const loginForm = rootElement.querySelector("#auth-login-form");
  const loadMeButton = rootElement.querySelector("#auth-load-me");
  const logoutButton = rootElement.querySelector("#auth-logout");

  function updateAuthState() {
    authStateEl.textContent = currentAuthState(bridge);
  }

  async function loadMe() {
    const { token } = bridge.getState();
    if (!token) {
      setMessage(messageEl, "No token set. Login first.", true);
      return;
    }

    try {
      const me = await apiRequest("/api/web/me", { token });
      bridge.setCurrentUser(me);
      setOutput(outputEl, me);
      setMessage(messageEl, "Profile loaded.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  }

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    try {
      const result = await apiRequest("/api/web/auth/register", {
        method: "POST",
        body: payload,
      });
      setOutput(outputEl, result);
      setMessage(messageEl, "User registered.");
      registerForm.reset();
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    try {
      const result = await apiRequest("/api/web/auth/login", {
        method: "POST",
        body: payload,
      });

      bridge.setToken(result.token || "");
      setOutput(outputEl, result);
      setMessage(messageEl, "Login successful.");
      await loadMe();
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  loadMeButton.addEventListener("click", async () => {
    await loadMe();
  });

  logoutButton.addEventListener("click", () => {
    bridge.clearSession();
    setOutput(outputEl, { status: "session cleared" });
    setMessage(messageEl, "Session cleared.");
  });

  bridge.subscribe(() => {
    updateAuthState();
  });

  updateAuthState();
}
