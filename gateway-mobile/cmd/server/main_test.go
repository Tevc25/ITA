package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGatewayMobileFlow(t *testing.T) {
	userMux := http.NewServeMux()
	userMux.HandleFunc("POST /auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"token":"abc"}`))
	})
	userMux.HandleFunc("GET /me", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"u-1","email":"u@example.com"}`))
	})
	userServer := httptest.NewServer(userMux)
	defer userServer.Close()

	parkingMux := http.NewServeMux()
	parkingMux.HandleFunc("GET /api/v1/parking-lots", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"parking_lots":[{"id":"p-1","name":"Center"}]}`))
	})
	parkingServer := httptest.NewServer(parkingMux)
	defer parkingServer.Close()

	reservationMux := http.NewServeMux()
	reservationMux.HandleFunc("GET /api/v1/users/u-1/reservations", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("scope") != "active" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"scope required"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[{"id":"r-1","status":"active"}]`))
	})
	reservationServer := httptest.NewServer(reservationMux)
	defer reservationServer.Close()

	cfg := Config{
		AppName:            "gateway-mobile",
		UporabnikiBaseURL:  userServer.URL,
		ParkiriscaBaseURL:  parkingServer.URL,
		RezervacijeBaseURL: reservationServer.URL,
		RequestTimeout:     2 * time.Second,
	}

	mux := newMux(cfg, &http.Client{Timeout: cfg.RequestTimeout})
	gateway := httptest.NewServer(mux)
	defer gateway.Close()

	healthResp, err := http.Get(gateway.URL + "/health")
	if err != nil {
		t.Fatalf("health request: %v", err)
	}
	defer healthResp.Body.Close()
	if healthResp.StatusCode != http.StatusOK {
		t.Fatalf("expected health 200, got %d", healthResp.StatusCode)
	}

	loginResp, err := http.Post(gateway.URL+"/api/mobile/session/login", "application/json", bytes.NewBufferString(`{"email":"u@example.com","password":"secret"}`))
	if err != nil {
		t.Fatalf("login request: %v", err)
	}
	defer loginResp.Body.Close()
	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected login 200, got %d", loginResp.StatusCode)
	}

	dashboardResp, err := http.Get(gateway.URL + "/api/mobile/dashboard/u-1")
	if err != nil {
		t.Fatalf("dashboard request: %v", err)
	}
	defer dashboardResp.Body.Close()
	if dashboardResp.StatusCode != http.StatusOK {
		t.Fatalf("expected dashboard 200, got %d", dashboardResp.StatusCode)
	}

	var payload map[string]any
	if err := json.NewDecoder(dashboardResp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode dashboard: %v", err)
	}

	if payload["user_id"] != "u-1" {
		t.Fatalf("expected user_id u-1, got %v", payload["user_id"])
	}
	if payload["generated_at"] == nil {
		t.Fatalf("expected generated_at field")
	}
}
