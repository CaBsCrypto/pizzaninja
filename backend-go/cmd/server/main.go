package main

import (
	"log"
	"net/http"

	"slash-slice-backend/internal/network"
)

func main() {
	hub := network.NewHub()
	go hub.StartGameLoop()

	http.HandleFunc("/ws", hub.HandleConnections)

	log.Println("Servidor de Go iniciado de forma segura en :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Error de red en el servidor: %v", err)
	}
}
