package network

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"slash-slice-backend/internal/game"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Configurar orígenes permitidos en producción
	},
}

type Hub struct {
	clients   map[*websocket.Conn]bool
	gameState *game.GameState
	mu        sync.Mutex
}

func NewHub() *Hub {
	// Inicializar juego mockeado
	pizzas := make(map[string]*game.Pizza)
	pizzas["p1"] = &game.Pizza{ID: "p1", Position: game.Point{X: 100, Y: 400}, Velocity: game.Point{X: 1.5, Y: -8.0}, Radius: 40.0}
	pizzas["p2"] = &game.Pizza{ID: "p2", Position: game.Point{X: 400, Y: 400}, Velocity: game.Point{X: -1.5, Y: -9.0}, Radius: 40.0}

	return &Hub{
		clients: make(map[*websocket.Conn]bool),
		gameState: &game.GameState{
			RoomID: "test-room",
			Pizzas: pizzas,
			Score:  0,
		},
	}
}

func (h *Hub) HandleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error al conectar WebSocket: %v", err)
		return
	}
	defer ws.Close()

	h.mu.Lock()
	h.clients[ws] = true
	h.mu.Unlock()

	log.Println("Cliente humano conectado al WebSocket de Go")

	for {
		_, msgBytes, err := ws.ReadMessage()
		if err != nil {
			h.mu.Lock()
			delete(h.clients, ws)
			h.mu.Unlock()
			break
		}

		var clientMsg game.ClientMessage
		if err := json.Unmarshal(msgBytes, &clientMsg); err == nil {
			if clientMsg.Type == "SLICE" {
				h.gameState.HandleSlash(clientMsg.Trajectory)
			}
		}
	}
}

func (h *Hub) StartGameLoop() {
	ticker := time.NewTicker(game.TickRate)
	defer ticker.Stop()

	for range ticker.C {
		h.gameState.UpdatePhysics()

		// Preparar mensaje de retransmisión
		h.mu.Lock()
		pizzasSlice := make([]*game.Pizza, 0, len(h.gameState.Pizzas))
		for _, p := range h.gameState.Pizzas {
			pizzasSlice = append(pizzasSlice, p)
		}

		payload := game.ServerMessage{
			Type:   "TICK",
			Pizzas: pizzasSlice,
			Score:  h.gameState.Score,
			IsOver: h.gameState.IsOver,
		}

		msgBytes, _ := json.Marshal(payload)

		// Retransmitir a todos los clientes conectados a la sala
		for client := range h.clients {
			_ = client.WriteMessage(websocket.TextMessage, msgBytes)
		}
		h.mu.Unlock()
	}
}
