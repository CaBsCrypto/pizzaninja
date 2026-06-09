package main

import (
	"log"
	"net/http"

	"slash-slice-backend/internal/blockchain"
	"slash-slice-backend/internal/inventory"
	"slash-slice-backend/internal/leaderboard"
	"slash-slice-backend/internal/network"

	"github.com/joho/godotenv"
)

func main() {
	// Cargar variables de entorno (ignorar si no existe el archivo .env)
	_ = godotenv.Load()

	// Iniciar servicio de Leaderboard (Upstash/Redis)
	lbService := leaderboard.NewService()

	// Iniciar cliente Soroban RPC y Servicio de Inventario
	sorobanClient := blockchain.NewSorobanClient()
	syncService := inventory.NewSyncService(sorobanClient)

	// Iniciar Hub con el servicio inyectado
	hub := network.NewHub(lbService, syncService)
	go hub.StartGameLoop()

	http.HandleFunc("/ws", hub.HandleConnections)

	log.Println("Servidor de Go iniciado de forma segura en :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Error de red en el servidor: %v", err)
	}
}
