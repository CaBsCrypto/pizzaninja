package leaderboard

import (
	"context"
	"os"

	"github.com/go-redis/redis/v8"
)

var ctx = context.Background()

type Service struct {
	client *redis.Client
}

func NewService() *Service {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	return &Service{
		client: rdb,
	}
}

func (s *Service) SaveScore(pubKey string, score int) error {
	return s.client.ZAdd(ctx, "leaderboards:global", &redis.Z{
		Score:  float64(score),
		Member: pubKey,
	}).Err()
}
