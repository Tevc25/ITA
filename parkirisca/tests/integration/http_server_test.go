package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/infrastructure/database"
	"parkirisca/internal/infrastructure/repository"
	httpiface "parkirisca/internal/interfaces/http"
)

func TestParkingServiceHTTPAndSwaggerFlow(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "integration-http.db")
	db, err := database.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := repository.NewSQLiteRepository(db)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	service := appservice.NewParkingServiceWithIDFactory(repo, logger, func() string { return "http-lot-1" })
	handler := httpiface.NewHandler(service)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	server := httptest.NewServer(mux)
	defer server.Close()

	openapiResp, err := http.Get(server.URL + "/openapi.json")
	if err != nil {
		t.Fatalf("openapi request: %v", err)
	}
	defer openapiResp.Body.Close()
	if openapiResp.StatusCode != http.StatusOK {
		t.Fatalf("expected openapi status 200, got %d", openapiResp.StatusCode)
	}

	docsResp, err := http.Get(server.URL + "/docs")
	if err != nil {
		t.Fatalf("docs request: %v", err)
	}
	defer docsResp.Body.Close()
	if docsResp.StatusCode != http.StatusOK {
		t.Fatalf("expected docs status 200, got %d", docsResp.StatusCode)
	}

	createBody := map[string]any{
		"name":            "Kongresni trg",
		"location":        "Ljubljana",
		"capacity":        50,
		"available_spots": 30,
	}
	created := postJSON(t, server.URL+"/api/v1/parking-lots", createBody, http.StatusCreated)

	lotRaw, ok := created["parking_lot"].(map[string]any)
	if !ok {
		t.Fatalf("missing parking_lot in create response")
	}
	if lotRaw["id"] != "http-lot-1" {
		t.Fatalf("expected id http-lot-1, got %v", lotRaw["id"])
	}

	getResp, err := http.Get(server.URL + "/api/v1/parking-lots/http-lot-1")
	if err != nil {
		t.Fatalf("get request: %v", err)
	}
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected get status 200, got %d", getResp.StatusCode)
	}

	patchPayload := map[string]any{"available_spots": 20}
	patchReqBody, _ := json.Marshal(patchPayload)
	patchReq, err := http.NewRequest(http.MethodPatch, server.URL+"/api/v1/parking-lots/http-lot-1/availability", bytes.NewBuffer(patchReqBody))
	if err != nil {
		t.Fatalf("build patch request: %v", err)
	}
	patchReq.Header.Set("Content-Type", "application/json")
	patchResp, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatalf("patch request: %v", err)
	}
	defer patchResp.Body.Close()
	if patchResp.StatusCode != http.StatusOK {
		t.Fatalf("expected patch status 200, got %d", patchResp.StatusCode)
	}

	listResp, err := http.Get(server.URL + "/api/v1/parking-lots")
	if err != nil {
		t.Fatalf("list request: %v", err)
	}
	defer listResp.Body.Close()
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected list status 200, got %d", listResp.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, server.URL+"/api/v1/parking-lots/http-lot-1", nil)
	if err != nil {
		t.Fatalf("build delete request: %v", err)
	}
	deleteResp, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatalf("delete request: %v", err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d", deleteResp.StatusCode)
	}

	missingResp, err := http.Get(server.URL + "/api/v1/parking-lots/http-lot-1")
	if err != nil {
		t.Fatalf("missing get request: %v", err)
	}
	defer missingResp.Body.Close()
	if missingResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected missing status 404, got %d", missingResp.StatusCode)
	}
}

func postJSON(t *testing.T, url string, payload map[string]any, expectedStatus int) map[string]any {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("post request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != expectedStatus {
		t.Fatalf("expected status %d, got %d", expectedStatus, resp.StatusCode)
	}

	result := map[string]any{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return result
}
