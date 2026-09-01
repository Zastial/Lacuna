// Package config lit la configuration depuis l'environnement — aucun
// secret en dur (§9 du plan).
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

func DatabaseURL() (string, error) {
	v := os.Getenv("DATABASE_URL")
	if v == "" {
		return "", fmt.Errorf("DATABASE_URL is not set")
	}
	return v, nil
}

func RedisURL() string {
	v := os.Getenv("REDIS_URL")
	if v == "" {
		return "redis://localhost:6379/0"
	}
	return v
}

func APIAddr() string {
	if v := os.Getenv("API_ADDR"); v != "" {
		return v
	}
	return ":8080"
}

func Duration(envVar string, def time.Duration) time.Duration {
	v := os.Getenv(envVar)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func Bool(envVar string, def bool) bool {
	v := os.Getenv(envVar)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}
