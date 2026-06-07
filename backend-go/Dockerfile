# Stage 1: Build the Go binary
FROM golang:1.25-alpine AS builder

# Configurar entorno para Go
ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

WORKDIR /app

# Copiar el código fuente
COPY . .

# Instalar dependencias faltantes (git es necesario para descargar algunos módulos de Go)
RUN apk add --no-cache git

# Resolver dependencias dinámicamente en base al código
RUN go mod tidy

# Compilar el binario
RUN go build -o slash-slice-server cmd/server/main.go

# Stage 2: Create a minimal production image
FROM alpine:3.18

WORKDIR /root/

# Copiar el binario compilado desde la etapa de construcción
COPY --from=builder /app/slash-slice-server .

# Exponer el puerto del servidor
EXPOSE 8080

# Ejecutar el servidor
CMD ["./slash-slice-server"]
