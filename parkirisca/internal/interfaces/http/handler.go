package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"parkirisca/internal/application/dto"
	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/domain"
)

type Handler struct {
	service *appservice.ParkingService
}

func NewHandler(service *appservice.ParkingService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.handleHealth)
	mux.HandleFunc("GET /docs", h.handleSwaggerUI)
	mux.HandleFunc("GET /swagger", h.handleSwaggerUI)
	mux.HandleFunc("GET /openapi.json", h.handleOpenAPI)

	mux.HandleFunc("GET /api/v1/parking-lots", h.handleListParkingLots)
	mux.HandleFunc("POST /api/v1/parking-lots", h.handleCreateParkingLot)
	mux.HandleFunc("GET /api/v1/parking-lots/{id}", h.handleGetParkingLot)
	mux.HandleFunc("PATCH /api/v1/parking-lots/{id}/availability", h.handleUpdateAvailability)
	mux.HandleFunc("DELETE /api/v1/parking-lots/{id}", h.handleDeleteParkingLot)
}

type parkingLotResponse struct {
	ParkingLot parkingLotDTO `json:"parking_lot"`
}

type parkingLotListResponse struct {
	ParkingLots []parkingLotDTO `json:"parking_lots"`
}

type deleteResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type parkingLotDTO struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Location       string `json:"location"`
	Capacity       int32  `json:"capacity"`
	AvailableSpots int32  `json:"available_spots"`
}

type createParkingLotRequest struct {
	Name           string `json:"name"`
	Location       string `json:"location"`
	Capacity       int32  `json:"capacity"`
	AvailableSpots int32  `json:"available_spots"`
}

type updateAvailabilityRequest struct {
	AvailableSpots int32 `json:"available_spots"`
}

func (h *Handler) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "parkirisca"})
}

func (h *Handler) handleSwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(swaggerUIPage))
}

func (h *Handler) handleOpenAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write([]byte(openAPISpec))
}

func (h *Handler) handleListParkingLots(w http.ResponseWriter, r *http.Request) {
	lots, err := h.service.ListParkingLots(r.Context())
	if err != nil {
		writeAppError(w, err)
		return
	}

	items := make([]parkingLotDTO, 0, len(lots))
	for _, lot := range lots {
		items = append(items, toParkingLotDTO(lot))
	}

	writeJSON(w, http.StatusOK, parkingLotListResponse{ParkingLots: items})
}

func (h *Handler) handleGetParkingLot(w http.ResponseWriter, r *http.Request) {
	lot, err := h.service.GetParkingLotByID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeAppError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, parkingLotResponse{ParkingLot: toParkingLotDTO(*lot)})
}

func (h *Handler) handleCreateParkingLot(w http.ResponseWriter, r *http.Request) {
	var req createParkingLotRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	created, err := h.service.CreateParkingLot(r.Context(), dto.CreateParkingLotInput{
		Name:           req.Name,
		Location:       req.Location,
		Capacity:       req.Capacity,
		AvailableSpots: req.AvailableSpots,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, parkingLotResponse{ParkingLot: toParkingLotDTO(*created)})
}

func (h *Handler) handleUpdateAvailability(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req updateAvailabilityRequest
	if err := decodeJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updated, err := h.service.UpdateAvailability(r.Context(), dto.UpdateAvailabilityInput{
		ID:             id,
		AvailableSpots: req.AvailableSpots,
	})
	if err != nil {
		writeAppError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, parkingLotResponse{ParkingLot: toParkingLotDTO(*updated)})
}

func (h *Handler) handleDeleteParkingLot(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteParkingLot(r.Context(), r.PathValue("id")); err != nil {
		writeAppError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, deleteResponse{Success: true, Message: "parking lot deleted"})
}

func toParkingLotDTO(lot domain.ParkingLot) parkingLotDTO {
	return parkingLotDTO{
		ID:             lot.ID,
		Name:           lot.Name,
		Location:       lot.Location,
		Capacity:       lot.Capacity,
		AvailableSpots: lot.AvailableSpots,
	}
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return errors.New("invalid JSON payload")
	}
	return nil
}

func writeAppError(w http.ResponseWriter, err error) {
	statusCode := http.StatusInternalServerError
	message := "internal server error"

	switch {
	case errors.Is(err, domain.ErrParkingLotNotFound):
		statusCode = http.StatusNotFound
		message = err.Error()
	case errors.Is(err, domain.ErrInvalidID),
		errors.Is(err, domain.ErrInvalidName),
		errors.Is(err, domain.ErrInvalidLocation),
		errors.Is(err, domain.ErrInvalidCapacity),
		errors.Is(err, domain.ErrInvalidAvailability),
		errors.Is(err, domain.ErrAvailabilityExceedsCap):
		statusCode = http.StatusBadRequest
		message = err.Error()
	}

	writeJSON(w, statusCode, errorResponse{Error: message})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, strings.TrimSpace(err.Error()), http.StatusInternalServerError)
	}
}
