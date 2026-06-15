package game

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"os"
	"time"

	"cloud.google.com/go/pubsub"
)

const (
	Gravity   = 9.8 / 30.0 // Ajustado a nuestro tick rate (30 FPS)
	TickRate  = 33 * time.Millisecond
	MaxHeight = 480.0
	MaxWidth  = 640.0
)

var pubsubClient *pubsub.Client
var pubsubTopic *pubsub.Topic

func init() {
	// Inicializar Pub/Sub en background
	go func() {
		projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
		if projectID == "" {
			projectID = "slashslice" // fallback
		}
		ctx := context.Background()
		client, err := pubsub.NewClient(ctx, projectID)
		if err != nil {
			log.Printf("Error creando cliente Pub/Sub: %v", err)
			return
		}
		pubsubClient = client
		topic := pubsubClient.Topic("pizza-slices-events")
		
		// Crear topic si no existe (solo para entorno dev/local, en prod debe existir)
		exists, err := topic.Exists(ctx)
		if err == nil && !exists {
			t, err := pubsubClient.CreateTopic(ctx, "pizza-slices-events")
			if err == nil {
				pubsubTopic = t
			}
		} else {
			pubsubTopic = topic
		}
		log.Println("Google Cloud Pub/Sub conectado: pizza-slices-events")
	}()
}

// Distancia de un punto a un segmento de línea
func distancePointToSegment(p Point, s1 Point, s2 Point) float64 {
	dx := s2.X - s1.X
	dy := s2.Y - s1.Y
	if dx == 0 && dy == 0 {
		return math.Hypot(p.X-s1.X, p.Y-s1.Y)
	}

	t := ((p.X-s1.X)*dx + (p.Y-s1.Y)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t))

	projectionX := s1.X + t*dx
	projectionY := s1.Y + t*dy

	return math.Hypot(p.X-projectionX, p.Y-projectionY)
}

func (gs *GameState) UpdatePhysics() {
	gs.Mu.Lock()
	defer gs.Mu.Unlock()

	for _, pizza := range gs.Pizzas {
		// Aplicar gravedad y velocidad solo si no está cortada (si está cortada, esperamos 1 frame para mostrar la animación antes de respawnear)
		if !pizza.IsCut {
			pizza.Position.X += pizza.Velocity.X
			pizza.Position.Y += pizza.Velocity.Y
			pizza.Velocity.Y += Gravity // Cae
		}

		// Si sale del límite de la pantalla o ya fue cortada, respawnear aleatoriamente
		if pizza.Position.Y > MaxHeight || pizza.IsCut {
			pizza.Position.Y = MaxHeight
			pizza.Position.X = float64(100 + (time.Now().UnixNano() % int64(MaxWidth-200)))
			pizza.Velocity.Y = -float64(8 + (time.Now().UnixNano() % 4))
			pizza.Velocity.X = float64(time.Now().UnixNano()%6) - 3.0
			pizza.IsCut = false
		}
	}
}

func (gs *GameState) HandleSlash(points []Point) {
	gs.Mu.Lock()
	defer gs.Mu.Unlock()

	if len(points) < 2 {
		return
	}

	for _, pizza := range gs.Pizzas {
		if pizza.IsCut {
			continue
		}

		// Validar contra la estela de cortes enviada por el cliente
		for i := 0; i < len(points)-1; i++ {
			dist := distancePointToSegment(pizza.Position, points[i], points[i+1])
			if dist <= pizza.Radius {
				pizza.IsCut = true
				gs.Score += 10 // Puntos agregados estrictamente en el Servidor (Anticheat)

				// Emitir evento a Pub/Sub de forma asíncrona para que la IA lo valide
				if pubsubTopic != nil {
					go emitSliceEvent(gs.RoomID, gs.Score, points)
				}

				break
			}
		}
	}
}

// emitSliceEvent serializa la trayectoria y la envía a Pub/Sub para que la lea el agente de Python
func emitSliceEvent(roomID string, newScore int, trajectory []Point) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payload := map[string]interface{}{
		"roomId":     roomID,
		"score":      newScore,
		"trajectory": trajectory,
		"timestamp":  time.Now().UnixNano(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error serializando payload Pub/Sub: %v", err)
		return
	}

	result := pubsubTopic.Publish(ctx, &pubsub.Message{
		Data: data,
	})

	// Esperamos confirmación asíncrona pero sin bloquear el hilo principal (esto ya está en su propia goroutine)
	_, err = result.Get(ctx)
	if err != nil {
		log.Printf("Error publicando a Pub/Sub: %v", err)
	}
}
