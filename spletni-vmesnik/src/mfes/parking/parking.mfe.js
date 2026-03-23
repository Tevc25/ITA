import { apiRequest, prettyJson } from "../../shared/http.js";

function setMessage(target, text, isError = false) {
  target.textContent = text || "";
  target.className = isError ? "message message-error" : "message message-ok";
}

function setOutput(target, payload) {
  target.value = prettyJson(payload);
}

function renderLots(listElement, lots) {
  if (!Array.isArray(lots) || lots.length === 0) {
    listElement.innerHTML = '<div class="item">No parking lots found.</div>';
    return;
  }

  listElement.innerHTML = lots
    .map(
      (lot) => `
      <div class="item">
        <strong>${lot.id} - ${lot.name}</strong>
        <div>Location: ${lot.location}</div>
        <div>Capacity: ${lot.capacity}</div>
        <div>Available: ${lot.available_spots}</div>
      </div>
    `,
    )
    .join("");
}

export function mountParkingMfe(rootElement, bridge) {
  rootElement.innerHTML = `
    <div class="mfe-header">
      <h2 class="mfe-title">Parking MFE</h2>
      <button id="parking-refresh" class="secondary" type="button">Refresh list</button>
    </div>

    <div class="mfe-section">
      <h3>Create parking lot</h3>
      <form id="parking-create-form">
        <label for="parking-name">Name</label>
        <input id="parking-name" name="name" type="text" required />

        <label for="parking-location">Location</label>
        <input id="parking-location" name="location" type="text" required />

        <label for="parking-capacity">Capacity</label>
        <input id="parking-capacity" name="capacity" type="number" min="1" required />

        <label for="parking-available">Available spots</label>
        <input id="parking-available" name="available_spots" type="number" min="0" required />

        <button type="submit">Create</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Get by ID</h3>
      <form id="parking-get-form">
        <label for="parking-get-id">Parking lot ID</label>
        <input id="parking-get-id" name="id" type="text" required />
        <button type="submit" class="secondary">Get parking lot</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Update availability</h3>
      <form id="parking-update-form">
        <label for="parking-update-id">Parking lot ID</label>
        <input id="parking-update-id" name="id" type="text" required />

        <label for="parking-update-available">New available spots</label>
        <input id="parking-update-available" name="available_spots" type="number" min="0" required />

        <button type="submit" class="secondary">Update availability</button>
      </form>
    </div>

    <div class="mfe-section">
      <h3>Delete parking lot</h3>
      <form id="parking-delete-form">
        <label for="parking-delete-id">Parking lot ID</label>
        <input id="parking-delete-id" name="id" type="text" required />
        <button type="submit" class="secondary">Delete</button>
      </form>
    </div>

    <p id="parking-message" class="message"></p>
    <textarea id="parking-output" class="mono-box" readonly aria-label="parking result"></textarea>

    <div class="mfe-section">
      <h3>Current parking lots</h3>
      <div id="parking-list" class="item-list"></div>
    </div>
  `;

  const messageEl = rootElement.querySelector("#parking-message");
  const outputEl = rootElement.querySelector("#parking-output");
  const listEl = rootElement.querySelector("#parking-list");

  const refreshButton = rootElement.querySelector("#parking-refresh");
  const createForm = rootElement.querySelector("#parking-create-form");
  const getForm = rootElement.querySelector("#parking-get-form");
  const updateForm = rootElement.querySelector("#parking-update-form");
  const deleteForm = rootElement.querySelector("#parking-delete-form");

  async function loadLots() {
    try {
      const result = await apiRequest("/api/web/parking-lots");
      renderLots(listEl, result?.parking_lots || []);
      setOutput(outputEl, result);
      setMessage(messageEl, "Parking lots loaded.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(createForm);
    const payload = {
      name: String(formData.get("name") || ""),
      location: String(formData.get("location") || ""),
      capacity: Number(formData.get("capacity") || 0),
      available_spots: Number(formData.get("available_spots") || 0),
    };

    try {
      const result = await apiRequest("/api/web/parking-lots", {
        method: "POST",
        body: payload,
      });
      setOutput(outputEl, result);
      setMessage(messageEl, "Parking lot created.");
      createForm.reset();
      await loadLots();
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  getForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = String(new FormData(getForm).get("id") || "").trim();

    try {
      const result = await apiRequest(`/api/web/parking-lots/${encodeURIComponent(id)}`);
      setOutput(outputEl, result);
      setMessage(messageEl, "Parking lot loaded.");
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  updateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(updateForm);
    const id = String(formData.get("id") || "").trim();
    const availableSpots = Number(formData.get("available_spots") || 0);

    try {
      const result = await apiRequest(`/api/web/parking-lots/${encodeURIComponent(id)}/availability`, {
        method: "PATCH",
        body: { available_spots: availableSpots },
      });
      setOutput(outputEl, result);
      setMessage(messageEl, "Availability updated.");
      await loadLots();
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = String(new FormData(deleteForm).get("id") || "").trim();

    try {
      const result = await apiRequest(`/api/web/parking-lots/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setOutput(outputEl, result);
      setMessage(messageEl, "Parking lot deleted.");
      deleteForm.reset();
      await loadLots();
    } catch (error) {
      setOutput(outputEl, error.payload || { message: error.message });
      setMessage(messageEl, error.message, true);
    }
  });

  refreshButton.addEventListener("click", async () => {
    await loadLots();
  });

  loadLots();
}
