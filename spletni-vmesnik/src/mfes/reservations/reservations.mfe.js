import { apiRequest, prettyJson, toIsoDateTime } from "../../shared/http.js";

function setMessage(target, text, isError = false) {
  target.textContent = text || "";
  target.className = isError ? "message message-error" : "message message-ok";
}

function setOutput(target, payload) {
  target.value = prettyJson(payload);
}

function reservationCard(item) {
  return `
    <div class="item">
      <strong>${item.id}</strong>
      <div>User: ${item.user_id}</div>
      <div>Parking lot: ${item.parking_lot_id}</div>
      <div>Vehicle: ${item.vehicle_plate}</div>
      <div>Status: ${item.status}</div>
      <div>From: ${item.start_time}</div>
      <div>To: ${item.end_time}</div>
    </div>
  `;
}

function renderReservationList(target, reservations) {
  if (!Array.isArray(reservations) || reservations.length === 0) {
    target.innerHTML = '<div class="item">No reservations for selected query.</div>';
    return;
  }

  target.innerHTML = reservations.map((item) => reservationCard(item)).join("");
}

function pickUserId(bridge, fallbackValue) {
  const userId = bridge.getState().currentUser?.id;
  return userId || fallbackValue || "";
}

export function mountReservationsMfe(rootElement, bridge) {
  rootElement.innerHTML = `
    <div class="mfe-header">
      <h2 class="mfe-title">Reservations MFE</h2>
      <small>Uses parking + user IDs</small>
    </div>

    <div class="mfe-section">
      <h3>Create reservation</h3>
      <form id="reservation-create-form">
        <label for="reservation-user-id">User ID</label>
        <input id="reservation-user-id" name="user_id" type="text" required />

        <label for="reservation-parking-id">Parking lot ID</label>
        <input id="reservation-parking-id" name="parking_lot_id" type="text" required />

        <label for="reservation-vehicle">Vehicle plate</label>
        <input id="reservation-vehicle" name="vehicle_plate" type="text" required />

        <label for="reservation-start">Start time</label>
        <input id="reservation-start" name="start_time" type="datetime-local" required />

        <label for="reservation-end">End time</label>
        <input id="reservation-end" name="end_time" type="datetime-local" required />

        <button type="submit">Create reservation</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Get reservation</h3>
      <form id="reservation-get-form">
        <label for="reservation-get-id">Reservation ID</label>
        <input id="reservation-get-id" name="id" type="text" required />
        <button type="submit" class="secondary">Get reservation</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Cancel reservation</h3>
      <form id="reservation-cancel-form">
        <label for="reservation-cancel-id">Reservation ID</label>
        <input id="reservation-cancel-id" name="reservation_id" type="text" required />

        <label for="reservation-cancel-user">User ID</label>
        <input id="reservation-cancel-user" name="user_id" type="text" required />

        <button type="submit" class="secondary">Cancel reservation</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>List user reservations</h3>
      <form id="reservation-list-form">
        <label for="reservation-list-user">User ID</label>
        <input id="reservation-list-user" name="user_id" type="text" required />

        <label for="reservation-list-scope">Scope</label>
        <select id="reservation-list-scope" name="scope">
          <option value="all">all</option>
          <option value="active">active</option>
          <option value="past">past</option>
        </select>

        <button type="submit" class="secondary">Load reservations</button>
      </form>
    </div>

    <p id="reservation-message" class="message"></p>
    <textarea id="reservation-output" class="mono-box" readonly aria-label="reservation result"></textarea>

    <div class="mfe-section">
      <h3>Result list</h3>
      <div id="reservation-list" class="item-list"></div>
    </div>
  `;

  const messageEl = rootElement.querySelector("#reservation-message");
  const outputEl = rootElement.querySelector("#reservation-output");
  const listEl = rootElement.querySelector("#reservation-list");

  const createForm = rootElement.querySelector("#reservation-create-form");
  const getForm = rootElement.querySelector("#reservation-get-form");
  const cancelForm = rootElement.querySelector("#reservation-cancel-form");
  const listForm = rootElement.querySelector("#reservation-list-form");

  const createUserInput = rootElement.querySelector("#reservation-user-id");
  const cancelUserInput = rootElement.querySelector("#reservation-cancel-user");
  const listUserInput = rootElement.querySelector("#reservation-list-user");

  function syncUserFields() {
    const rememberedUserId = bridge.getState().currentUser?.id || "";
    if (rememberedUserId) {
      createUserInput.value = rememberedUserId;
      cancelUserInput.value = rememberedUserId;
      listUserInput.value = rememberedUserId;
    }
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(createForm);
    const payload = {
      user_id: pickUserId(bridge, String(data.get("user_id") || "").trim()),
      parking_lot_id: String(data.get("parking_lot_id") || "").trim(),
      vehicle_plate: String(data.get("vehicle_plate") || "").trim(),
      start_time: toIsoDateTime(String(data.get("start_time") || "")),
      end_time: toIsoDateTime(String(data.get("end_time") || "")),
    };

    try {
      const result = await apiRequest("/api/web/reservations", {
        method: "POST",
        body: payload,
      });
      setOutput(outputEl, result);
      renderReservationList(listEl, [result]);
      setMessage(messageEl, "Reservation created.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  getForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = String(new FormData(getForm).get("id") || "").trim();

    try {
      const result = await apiRequest(`/api/web/reservations/${encodeURIComponent(id)}`);
      setOutput(outputEl, result);
      renderReservationList(listEl, [result]);
      setMessage(messageEl, "Reservation loaded.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  cancelForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(cancelForm);
    const reservationId = String(data.get("reservation_id") || "").trim();
    const userId = pickUserId(bridge, String(data.get("user_id") || "").trim());

    try {
      const result = await apiRequest(`/api/web/reservations/${encodeURIComponent(reservationId)}/cancel`, {
        method: "POST",
        body: { user_id: userId },
      });
      setOutput(outputEl, result);
      renderReservationList(listEl, [result]);
      setMessage(messageEl, "Reservation cancelled.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  listForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(listForm);
    const userId = pickUserId(bridge, String(data.get("user_id") || "").trim());
    const scope = String(data.get("scope") || "all");

    try {
      const result = await apiRequest(
        `/api/web/users/${encodeURIComponent(userId)}/reservations?scope=${encodeURIComponent(scope)}`,
      );
      setOutput(outputEl, result);
      renderReservationList(listEl, result);
      setMessage(messageEl, "User reservations loaded.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  bridge.subscribe(() => {
    syncUserFields();
  });

  syncUserFields();
  renderReservationList(listEl, []);
}
