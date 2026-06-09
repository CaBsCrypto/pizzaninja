package network

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"slash-slice-backend/internal/blockchain"
	"slash-slice-backend/internal/game"
	"slash-slice-backend/internal/inventory"
	"slash-slice-backend/internal/leaderboard"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Configurar orígenes permitidos en producción
	},
}

type Hub struct {
	clients     map[*websocket.Conn]bool
	gameState   *game.GameState
	leaderboard *leaderboard.Service
	syncService *inventory.SyncService
	mu          sync.Mutex
}

func NewHub(lb *leaderboard.Service, sync *inventory.SyncService) *Hub {
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
		leaderboard: lb,
		syncService: sync,
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

		var clientMsg struct {
			Type       string     `json:"type"`
			Trajectory []game.Point `json:"trajectory,omitempty"`
			PubKey     string     `json:"pubKey,omitempty"`
			Score      int        `json:"score,omitempty"`
		}

		if err := json.Unmarshal(msgBytes, &clientMsg); err == nil {
			if clientMsg.Type == "SLICE" {
				h.gameState.HandleSlash(clientMsg.Trajectory)
			} else if clientMsg.Type == "WALLET_CONNECT" {
				log.Printf("Wallet conectada: %s. Consultando NFTs...", clientMsg.PubKey)
				
				if h.syncService != nil && clientMsg.PubKey != "" {
					inv := h.syncService.SyncPlayer(context.Background(), clientMsg.PubKey)
					if inv != nil {
						// Send inventory update back to client
						resp := struct {
							Type      string                     `json:"type"`
							Inventory *inventory.PlayerInventory `json:"inventory"`
						}{
							Type:      "INVENTORY_UPDATE",
							Inventory: inv,
						}
						respBytes, _ := json.Marshal(resp)
						
						h.mu.Lock()
						_ = ws.WriteMessage(websocket.TextMessage, respBytes)
						h.mu.Unlock()
					}
				}
			} else if clientMsg.Type == "SCORE_SUBMIT" {
				log.Printf("Game Over para %s. Puntaje final: %d", clientMsg.PubKey, clientMsg.Score)
				
				// 1. Guardar en Redis Leaderboard
				if h.leaderboard != nil && clientMsg.PubKey != "" {
					err := h.leaderboard.SaveScore(clientMsg.PubKey, clientMsg.Score)
					if err != nil {
						log.Printf("Error al guardar en Redis: %v", err)
					} else {
						log.Printf("Récord guardado exitosamente en la bóveda.")
					}
				}

				// 2. Calcular Harvest de Ingredientes
				harvest := game.CalculateHarvest(clientMsg.Score)
				log.Printf("Harvest Calculado: Queso: %d, Pepperoni: %d, Cebolla: %d, Panceta: %d", 
					harvest.Cheese, harvest.Pepperoni, harvest.Onion, harvest.Bacon)

				// TODO: Disparar Sponsored Fee-Bump a Soroban RPC aquí para mintear recompensas.
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
