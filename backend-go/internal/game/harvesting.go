package game

import "math"

type HarvestedIngredients struct {
	Cheese    int `json:"cheese"`
	Pepperoni int `json:"pepperoni"`
	Onion     int `json:"onion"`
	Bacon     int `json:"bacon"`
}

func CalculateHarvest(score int) HarvestedIngredients {
	harvest := HarvestedIngredients{
		Cheese:    int(math.Min(3, float64(score/2500)+1)),
		Pepperoni: 0,
		Onion:     0,
		Bacon:     0,
	}

	if score > 3000 {
		harvest.Pepperoni = int(math.Min(2, float64((score-3000)/3000)+1))
	}
	if score > 4000 {
		harvest.Onion = 1
	}
	if score > 5000 {
		harvest.Bacon = 1
	}

	return harvest
}
