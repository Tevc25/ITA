package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

type Config struct {
	AppName            string
	Port               string
	UporabnikiBaseURL  string
	ParkiriscaBaseURL  string
	RezervacijeBaseURL string
	RequestTimeout     time.Duration
}

func loadConfig() Config {
	return Config{
		AppName:            getEnv("APP_NAME", "gateway-mobile"),
		Port:               getEnv("PORT", "8091"),
		UporabnikiBaseURL:  getEnv("UPORABNIKI_BASE_URL", "http://uporabniki:3000"),
		ParkiriscaBaseURL:  getEnv("PARKIRISCA_BASE_URL", "http://parkirisca:8080"),
		RezervacijeBaseURL: getEnv("REZERVACIJE_BASE_URL", "http://rezervacije-parkiranja:8000"),
		RequestTimeout:     10 * time.Second,
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func main() {
	cfg := loadConfig()
	client := &http.Client{Timeout: cfg.RequestTimeout}

	mux := newMux(cfg, client)
	addr := ":" + cfg.Port

	log.Printf("%s listening on %s", cfg.AppName, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("gateway-mobile failed: %v", err)
	}
}

func newMux(cfg Config, client *http.Client) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": cfg.AppName,
			"client":  "mobile",
		})
	})

	mux.HandleFunc("POST /api/mobile/session/register", func(w http.ResponseWriter, r *http.Request) {
		forwardJSONBody(w, r, client, cfg.UporabnikiBaseURL+"/auth/register")
	})

	mux.HandleFunc("POST /api/mobile/session/login", func(w http.ResponseWriter, r *http.Request) {
		forwardJSONBody(w, r, client, cfg.UporabnikiBaseURL+"/auth/login")
	})

	mux.HandleFunc("GET /api/mobile/profile", func(w http.ResponseWriter, r *http.Request) {
		forwardNoBody(w, r, client, cfg.UporabnikiBaseURL+"/me")
	})

	mux.HandleFunc("GET /api/mobile/parking", func(w http.ResponseWriter, r *http.Request) {
		forwardNoBody(w, r, client, cfg.ParkiriscaBaseURL+"/api/v1/parking-lots")
	})

	mux.HandleFunc("POST /api/mobile/booking", func(w http.ResponseWriter, r *http.Request) {
		forwardJSONBody(w, r, client, cfg.RezervacijeBaseURL+"/api/v1/reservations")
	})

	mux.HandleFunc("POST /api/mobile/booking/{reservationId}/cancel", func(w http.ResponseWriter, r *http.Request) {
		reservationID := r.PathValue("reservationId")
		forwardJSONBody(w, r, client, fmt.Sprintf("%s/api/v1/reservations/%s/cancel", cfg.RezervacijeBaseURL, url.PathEscape(reservationID)))
	})

	mux.HandleFunc("GET /api/mobile/booking/{reservationId}", func(w http.ResponseWriter, r *http.Request) {
		reservationID := r.PathValue("reservationId")
		forwardNoBody(w, r, client, fmt.Sprintf("%s/api/v1/reservations/%s", cfg.RezervacijeBaseURL, url.PathEscape(reservationID)))
	})

	mux.HandleFunc("GET /api/mobile/dashboard/{userId}", func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("userId")
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId is required"})
			return
		}

		reservationsURL := fmt.Sprintf("%s/api/v1/users/%s/reservations?scope=active", cfg.RezervacijeBaseURL, url.PathEscape(userID))
		parkingURL := cfg.ParkiriscaBaseURL + "/api/v1/parking-lots"

		activeReservations, statusCode, err := fetchJSON(client, reservationsURL, r.Header.Get("Authorization"))
		if err != nil {
			writeJSON(w, statusCode, map[string]string{"error": err.Error()})
			return
		}

		parkingLots, statusCode, err := fetchJSON(client, parkingURL, "")
		if err != nil {
			writeJSON(w, statusCode, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"user_id":             userID,
			"active_reservations": activeReservations,
			"parking_lots":        parkingLots,
			"generated_at":        time.Now().UTC().Format(time.RFC3339),
		})
	})

	return mux
}

func forwardNoBody(w http.ResponseWriter, r *http.Request, client *http.Client, targetURL string) {
	req, err := http.NewRequest(r.Method, targetURL, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	copyAuthHeader(req, r)
	executeAndRelay(w, client, req)
}

func forwardJSONBody(w http.ResponseWriter, r *http.Request, client *http.Client, targetURL string) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req, err := http.NewRequest(r.Method, targetURL, bytes.NewReader(body))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	copyAuthHeader(req, r)
	executeAndRelay(w, client, req)
}

func executeAndRelay(w http.ResponseWriter, client *http.Client, req *http.Request) {
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid upstream response"})
		return
	}

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(body)
}

func fetchJSON(client *http.Client, targetURL string, authHeader string) (any, int, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("upstream unavailable")
	}
	defer resp.Body.Close()

	var payload any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("invalid upstream JSON")
	}

	if resp.StatusCode >= 400 {
		return nil, resp.StatusCode, fmt.Errorf("upstream status %d", resp.StatusCode)
	}

	return payload, http.StatusOK, nil
}

func copyAuthHeader(dst *http.Request, src *http.Request) {
	if auth := src.Header.Get("Authorization"); auth != "" {
		dst.Header.Set("Authorization", auth)
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
