package game

import "sync"

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Pizza struct {
	ID        string  `json:"id"`
	Position  Point   `json:"position"`
	Velocity  Point   `json:"velocity"`
	IsCut     bool    `json:"isCut"`
	Radius    float64 `json:"radius"`
}

type GameState struct {
	RoomID   string            `json:"roomId"`
	Pizzas   map[string]*Pizza `json:"pizzas"`
	Score    int               `json:"score"`
	IsOver   bool              `json:"isOver"`
	Mu       sync.RWMutex      `json:"-"`
}

type ClientMessage struct {
	Type       string  `json:"type"`       // "SLICE"
	Trajectory []Point `json:"trajectory"` // Estela de cortes enviada por el cliente
}

type ServerMessage struct {
	Type   string   `json:"type"`   // "TICK" o "SCORE_UPDATE"
	Pizzas []*Pizza `json:"pizzas"`
	Score  int      `json:"score"`
	IsOver bool     `json:"isOver"`
}
