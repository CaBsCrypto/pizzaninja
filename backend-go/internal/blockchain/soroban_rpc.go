package blockchain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	TestnetRPC = "https://soroban-testnet.stellar.org"
	
	// Contratos provenientes del agente de Rhythm Slice
	NFTContract      = "CBC3AGOZTWKEII45VBRWLOGMBNGBJ6ABPP6MOFAZM2HFHP2NKPXXEWXB"
	SliceToken       = "CDQQS675FAF3GXEV4Y5CQVWVHWOONDWMIM2QDVSQUHADA3XDDXSXZOFR"
	PepperoniContract = "CBE5ZVJPGYORQYZ5ZCLBGKX2HUQVCL2HKGR2T5D4SLFGS73VJYVLPNUW"
	CheeseContract   = "CBFQYO2ML6ITTZLO46Z6WXUCOV4FLCRYHUBLC7RLERF5OM2G4Q324UGM"
)

type SorobanClient struct {
	rpcURL     string
	httpClient *http.Client
}

func NewSorobanClient() *SorobanClient {
	rpc := os.Getenv("SOROBAN_RPC_URL")
	if rpc == "" {
		rpc = TestnetRPC // Volvemos a Testnet por defecto
	}

	return &SorobanClient{
		rpcURL: rpc,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// jsonrpcRequest represents a standard JSON-RPC 2.0 request
type jsonrpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

// FetchNFTBalance consultará (mediante simulateTransaction) el contrato de NFTs
func (c *SorobanClient) FetchNFTBalance(ctx context.Context, pubKey string) ([]uint32, error) {
	log.Printf("[SorobanRPC] Consultando balance_of(%s) en el contrato %s", pubKey, NFTContract)
	
	// TODO: Generar el XDR real de la invocación a `balance_of` y enviarlo a simulateTransaction.
	// Por ahora, simularemos la respuesta de red para la integración con React.
	
	// Si el pubKey termina en ciertas letras, le damos Hornos Raros para probar
	var mockIDs []uint32
	if len(pubKey) > 0 {
		if pubKey[len(pubKey)-1] == 'A' {
			mockIDs = []uint32{405} // Horno de Ladrillo
		} else if pubKey[len(pubKey)-1] == 'B' {
			mockIDs = []uint32{888} // Horno del Capo
		} else {
			mockIDs = []uint32{15} // Horno Clásico
		}
	}

	return mockIDs, nil
}
