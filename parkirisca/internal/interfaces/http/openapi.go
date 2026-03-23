package http

const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Parkirisca API",
    "version": "1.0.0",
    "description": "HTTP API in Swagger dokumentacija za mikrostoritev parkirisca."
  },
  "servers": [
    {
      "url": "/"
    }
  ],
  "paths": {
    "/api/v1/parking-lots": {
      "get": {
        "summary": "Seznam parkirisc",
        "tags": ["parking-lots"],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ParkingLotListResponse"
                }
              }
            }
          }
        }
      },
      "post": {
        "summary": "Ustvari parkirisce",
        "tags": ["parking-lots"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateParkingLotRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ParkingLotResponse"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/parking-lots/{id}": {
      "get": {
        "summary": "Pridobi parkirisce po ID",
        "tags": ["parking-lots"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ParkingLotResponse"
                }
              }
            }
          },
          "404": {
            "description": "Not Found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      },
      "delete": {
        "summary": "Izbrisi parkirisce",
        "tags": ["parking-lots"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/DeleteResponse"
                }
              }
            }
          },
          "404": {
            "description": "Not Found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/parking-lots/{id}/availability": {
      "patch": {
        "summary": "Posodobi razpolozljivost",
        "tags": ["parking-lots"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateAvailabilityRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ParkingLotResponse"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "404": {
            "description": "Not Found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Health check",
        "tags": ["system"],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "ParkingLot": {
        "type": "object",
        "properties": {
          "id": {"type": "string"},
          "name": {"type": "string"},
          "location": {"type": "string"},
          "capacity": {"type": "integer", "format": "int32"},
          "available_spots": {"type": "integer", "format": "int32"}
        },
        "required": ["id", "name", "location", "capacity", "available_spots"]
      },
      "CreateParkingLotRequest": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "location": {"type": "string"},
          "capacity": {"type": "integer", "format": "int32"},
          "available_spots": {"type": "integer", "format": "int32"}
        },
        "required": ["name", "location", "capacity", "available_spots"]
      },
      "UpdateAvailabilityRequest": {
        "type": "object",
        "properties": {
          "available_spots": {"type": "integer", "format": "int32"}
        },
        "required": ["available_spots"]
      },
      "ParkingLotResponse": {
        "type": "object",
        "properties": {
          "parking_lot": {
            "$ref": "#/components/schemas/ParkingLot"
          }
        },
        "required": ["parking_lot"]
      },
      "ParkingLotListResponse": {
        "type": "object",
        "properties": {
          "parking_lots": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ParkingLot"
            }
          }
        },
        "required": ["parking_lots"]
      },
      "DeleteResponse": {
        "type": "object",
        "properties": {
          "success": {"type": "boolean"},
          "message": {"type": "string"}
        },
        "required": ["success", "message"]
      },
      "ErrorResponse": {
        "type": "object",
        "properties": {
          "error": {"type": "string"}
        },
        "required": ["error"]
      }
    }
  }
}`

const swaggerUIPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Parkirisca Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`
