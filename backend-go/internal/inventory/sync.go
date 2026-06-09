package inventory

import (
	"context"
	"log"

	"slash-slice-backend/internal/blockchain"
)

type SyncService struct {
	soroban *blockchain.SorobanClient
}

func NewSyncService(soroban *blockchain.SorobanClient) *SyncService {
	return &SyncService{
		soroban: soroban,
	}
}

// PlayerInventory representa los ítems desbloqueados basados en Soroban
type PlayerInventory struct {
	PubKey         string   `json:"pubKey"`
	UnlockedKnives []string `json:"unlockedKnives"`
}

func (s *SyncService) SyncPlayer(ctx context.Context, pubKey string) *PlayerInventory {
	log.Printf("[SyncService] Sincronizando inventario para %s", pubKey)

	tokenIDs, err := s.soroban.FetchNFTBalance(ctx, pubKey)
	if err != nil {
		log.Printf("[SyncService] Error obteniendo NFTs: %v", err)
		return nil
	}

	inventory := &PlayerInventory{
		PubKey:         pubKey,
		UnlockedKnives: []string{"fire"}, // Por defecto todos tienen el cuchillo de fuego
	}

	// Parsear rareza según el documento de diseño
	for _, id := range tokenIDs {
		if id >= 1 && id <= 400 {
			inventory.UnlockedKnives = append(inventory.UnlockedKnives, "basil") // Horno Clásico -> Cuchillo Basil
		} else if id >= 401 && id <= 700 {
			inventory.UnlockedKnives = append(inventory.UnlockedKnives, "cyber") // Horno de Ladrillo -> Cuchillo Cyber
		} else if id >= 701 && id <= 888 {
			// Hornos Raros y Legendarios desbloquean el de Oro
			inventory.UnlockedKnives = append(inventory.UnlockedKnives, "gold") 
		}
	}

	return inventory
}
