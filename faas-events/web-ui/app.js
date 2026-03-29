import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js";

const STORAGE_KEYS = {
  token: "faas.events.ui.token",
  baseUrl: "faas.events.ui.baseUrl",
};

function asIso(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

createApp({
  data() {
    const storedBaseUrl = localStorage.getItem(STORAGE_KEYS.baseUrl);
    const defaultBaseUrl = "http://localhost:3010";

    return {
      baseUrl: storedBaseUrl || defaultBaseUrl,
      baseUrlInput: storedBaseUrl || defaultBaseUrl,
      token: localStorage.getItem(STORAGE_KEYS.token) || "",
      meData: null,
      logs: [],

      registerForm: {
        name: "",
        email: "",
        password: "",
      },

      loginForm: {
        email: "",
        password: "",
      },

      parkingCreate: {
        name: "",
        location: "",
        capacity: 40,
        availableSpots: 40,
      },

      parkingUpdate: {
        parkingLotId: "",
        availableSpots: 0,
      },

      parkingLots: [],

      reservationCreate: {
        parkingLotId: "",
        vehiclePlate: "",
        startTime: "",
        endTime: "",
      },

      reservationStatusFilter: "",
      reservationToCancel: "",
      reservations: [],

      upload: {
        reservationId: "",
        file: null,
        uploadUrl: "",
        objectKey: "",
        contentType: "",
      },
    };
  },

  computed: {
    isAuthenticated() {
      return Boolean(this.token);
    },

    tokenPreview() {
      if (!this.token) {
        return "JWT ni nastavljen";
      }

      return `${this.token.slice(0, 14)}...`;
    },
  },

  methods: {
    pretty(value) {
      return JSON.stringify(value, null, 2);
    },

    log(type, message) {
      const now = new Date();
      this.logs.unshift({
        id: crypto.randomUUID(),
        type,
        message,
        time: now.toLocaleTimeString("sl-SI", { hour12: false }),
      });

      if (this.logs.length > 250) {
        this.logs = this.logs.slice(0, 250);
      }
    },

    saveBaseUrl() {
      const normalized = trimTrailingSlash(this.baseUrlInput.trim());
      if (!normalized) {
        this.log("error", "Base URL ne sme biti prazen.");
        return;
      }

      this.baseUrl = normalized;
      localStorage.setItem(STORAGE_KEYS.baseUrl, normalized);
      this.log("success", `Base URL nastavljen na ${normalized}`);
    },

    setToken(token) {
      this.token = token || "";

      if (this.token) {
        localStorage.setItem(STORAGE_KEYS.token, this.token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.token);
      }
    },

    logout() {
      this.setToken("");
      this.meData = null;
      this.log("success", "Uporabnik je odjavljen.");
    },

    async apiRequest(path, options = {}) {
      const {
        method = "GET",
        requiresAuth = true,
        body = undefined,
        headers = {},
      } = options;

      const url = `${trimTrailingSlash(this.baseUrl)}${path}`;
      const reqHeaders = {
        ...headers,
      };

      if (requiresAuth && this.token) {
        reqHeaders.Authorization = `Bearer ${this.token}`;
      }

      const payload = body === undefined ? undefined : JSON.stringify(body);
      if (payload !== undefined) {
        reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
      }

      const response = await fetch(url, {
        method,
        headers: reqHeaders,
        body: payload,
      });

      const rawText = await response.text();
      let parsed;

      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsed = { message: rawText };
      }

      if (parsed && typeof parsed.body === "string") {
        try {
          parsed = JSON.parse(parsed.body);
        } catch {
          parsed = { message: parsed.body };
        }
      } else if (parsed && typeof parsed.body === "object") {
        parsed = parsed.body;
      }

      if (!response.ok) {
        const message = parsed?.message || `HTTP ${response.status}`;
        throw new Error(message);
      }

      return parsed;
    },

    async register() {
      try {
        const data = await this.apiRequest("/auth/register", {
          method: "POST",
          requiresAuth: false,
          body: this.registerForm,
        });

        if (data.token) {
          this.setToken(data.token);
        }

        this.loginForm.email = this.registerForm.email;
        this.log("success", `Registracija uspešna (${data.email || "uporabnik"}).`);
        await this.loadMe();
      } catch (error) {
        this.log("error", `Register error: ${error.message}`);
      }
    },

    async login() {
      try {
        const data = await this.apiRequest("/auth/login", {
          method: "POST",
          requiresAuth: false,
          body: this.loginForm,
        });

        this.setToken(data.token || "");
        this.log("success", "Prijava uspešna.");
        await this.loadMe();
      } catch (error) {
        this.log("error", `Login error: ${error.message}`);
      }
    },

    async loadMe() {
      if (!this.isAuthenticated) {
        this.log("error", "Najprej se prijavi (JWT token manjka).");
        return;
      }

      try {
        this.meData = await this.apiRequest("/auth/me", { method: "GET" });
        this.log("success", "Profil uspešno naložen.");
      } catch (error) {
        this.log("error", `/auth/me error: ${error.message}`);
      }
    },

    async createParkingLot() {
      try {
        const payload = {
          ...this.parkingCreate,
          capacity: Number(this.parkingCreate.capacity),
          availableSpots: Number(this.parkingCreate.availableSpots),
        };

        const created = await this.apiRequest("/parking", {
          method: "POST",
          body: payload,
        });

        this.parkingUpdate.parkingLotId = created.parkingLotId || "";
        this.reservationCreate.parkingLotId = created.parkingLotId || "";

        this.log("success", `Parkirišče ustvarjeno (${created.parkingLotId || "n/a"}).`);
        await this.listParkingLots(false);
      } catch (error) {
        this.log("error", `Create parking error: ${error.message}`);
      }
    },

    async listParkingLots(onlyAvailable) {
      try {
        const suffix = onlyAvailable ? "?onlyAvailable=true" : "";
        const data = await this.apiRequest(`/parking${suffix}`, { method: "GET" });
        this.parkingLots = data.parkingLots || [];
        this.log("success", `Naloženih parkirišč: ${this.parkingLots.length}.`);
      } catch (error) {
        this.log("error", `List parking error: ${error.message}`);
      }
    },

    async updateAvailability() {
      if (!this.parkingUpdate.parkingLotId) {
        this.log("error", "Vnesi parkingLotId za posodobitev.");
        return;
      }

      try {
        const data = await this.apiRequest(
          `/parking/${this.parkingUpdate.parkingLotId}/availability`,
          {
            method: "PATCH",
            body: { availableSpots: Number(this.parkingUpdate.availableSpots) },
          },
        );

        this.log(
          "success",
          `Posodobljeno: ${data?.parkingLot?.parkingLotId || this.parkingUpdate.parkingLotId}`,
        );

        await this.listParkingLots(false);
      } catch (error) {
        this.log("error", `Update availability error: ${error.message}`);
      }
    },

    async createReservation() {
      if (!this.reservationCreate.parkingLotId) {
        this.log("error", "parkingLotId je obvezen.");
        return;
      }

      const payload = {
        parkingLotId: this.reservationCreate.parkingLotId,
        vehiclePlate: this.reservationCreate.vehiclePlate,
        startTime: asIso(this.reservationCreate.startTime),
        endTime: asIso(this.reservationCreate.endTime),
      };

      if (!payload.startTime || !payload.endTime) {
        this.log("error", "Neveljaven start/end datum.");
        return;
      }

      try {
        const data = await this.apiRequest("/reservations", {
          method: "POST",
          body: payload,
        });

        const reservationId = data?.reservation?.reservationId;
        if (reservationId) {
          this.reservationToCancel = reservationId;
          this.upload.reservationId = reservationId;
        }

        this.log("success", `Rezervacija ustvarjena (${reservationId || "n/a"}).`);
        await this.listReservations();
      } catch (error) {
        this.log("error", `Create reservation error: ${error.message}`);
      }
    },

    async listReservations() {
      try {
        const filter = this.reservationStatusFilter
          ? `?status=${encodeURIComponent(this.reservationStatusFilter)}`
          : "";

        const data = await this.apiRequest(`/reservations/mine${filter}`, {
          method: "GET",
        });

        this.reservations = data.reservations || [];
        this.log("success", `Naloženih rezervacij: ${this.reservations.length}.`);
      } catch (error) {
        this.log("error", `List reservations error: ${error.message}`);
      }
    },

    async cancelReservation() {
      if (!this.reservationToCancel) {
        this.log("error", "Vnesi reservationId za preklic.");
        return;
      }

      try {
        await this.apiRequest(`/reservations/${this.reservationToCancel}/cancel`, {
          method: "PATCH",
        });

        this.log("success", `Rezervacija ${this.reservationToCancel} preklicana.`);
        await this.listReservations();
      } catch (error) {
        this.log("error", `Cancel reservation error: ${error.message}`);
      }
    },

    onFileChange(event) {
      const file = event.target.files?.[0] || null;
      this.upload.file = file;

      if (file) {
        this.upload.contentType = file.type || "application/octet-stream";
        this.log("success", `Izbrana datoteka: ${file.name}`);
      }
    },

    async getUploadUrl() {
      if (!this.upload.reservationId) {
        this.log("error", "Vnesi reservationId za upload URL.");
        return;
      }

      const contentType = this.upload.file?.type || "image/jpeg";

      try {
        const data = await this.apiRequest(
          `/reservations/${this.upload.reservationId}/evidence/upload-url`,
          {
            method: "POST",
            body: { contentType },
          },
        );

        this.upload.uploadUrl = data.uploadUrl || "";
        this.upload.objectKey = data.objectKey || "";
        this.upload.contentType = data.contentType || contentType;

        this.log("success", "Upload URL uspešno pridobljen.");
      } catch (error) {
        this.log("error", `Get upload URL error: ${error.message}`);
      }
    },

    async uploadSelectedFile() {
      if (!this.upload.uploadUrl || !this.upload.file) {
        this.log("error", "Najprej izberi datoteko in pridobi upload URL.");
        return;
      }

      try {
        const response = await fetch(this.upload.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": this.upload.file.type || "application/octet-stream",
          },
          body: this.upload.file,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.log("success", "Datoteka uspešno naložena v S3.");
      } catch (error) {
        this.log("error", `Upload error: ${error.message}`);
      }
    },
  },

  mounted() {
    this.log("success", "UI inicializiran.");
    this.log("success", `Aktivni backend: ${this.baseUrl}`);

    if (this.isAuthenticated) {
      this.log("success", "Najden shranjen JWT token.");
      this.loadMe();
    }
  },
}).mount("#app");
