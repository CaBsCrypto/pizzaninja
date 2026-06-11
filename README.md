# 🍕 Slash Slice Arena - Turtle Ninja Edition

![Slash Slice Arena Banner](https://slashslice.spicycrust.com/bg-dark.webp)

**Slash Slice Arena** es una Prueba de Concepto (PoC) técnica que combina visión artificial (Computer Vision), interfaces modernas y tecnologías Web3, todo ejecutándose fluidamente dentro del navegador. 

Los jugadores asumen el rol de un Ninja Cortador de Pizzas, usando sus propias manos frente a la cámara web para rebanar ingredientes que vuelan por el aire, simulando un juego arcade clásico, pero con físicas modernas y registro de puntuaciones inmutable en la blockchain.

## 🚀 Tecnologías Clave (Stack)

Esta PoC demuestra la integración fluida de 3 pilares tecnológicos fundamentales:

### 1. Visión Artificial en Tiempo Real (Edge AI)
- **MediaPipe (Google):** Procesamiento de imágenes en el cliente.
- Detecta y mapea en 3D los 21 puntos clave de la mano humana a 60 FPS directamente en el navegador, sin necesidad de servidores externos.
- **Detección de Colisiones 2D:** El dedo índice (Landmark 8) se usa como el punto de la espada, calculando trayectorias (slashes) interpoladas matemáticamente para cortar objetos en movimiento en un canvas HTML5.

### 2. Autenticación Web3 "Invisible" (Fricción Cero)
- **Web3Auth v9:** Tecnología de computación multiparte (MPC) que permite la creación de billeteras criptográficas (Stellar) usando un simple login social (Gmail).
- **Stellar Network (Soroban):** Las billeteras generadas son compatibles con la red Stellar. En esta PoC, se simula el minteo de registros de puntuación como Smart Contracts (NFTs) en la red Soroban, demostrando cómo una capa blockchain puede añadir inmutabilidad y propiedad (Ownership) a los récords y objetos cosméticos de un juego.
- **Abstracción de Bóveda:** Los jugadores no necesitan saber qué es una "frase semilla" ni instalar extensiones. Entran con Google y ya están en la Web3.

### 3. Interfaz de Usuario AAA (React + Tailwind)
- **React 18 & TypeScript:** Tipado estricto y gestión de estado escalable.
- **Tailwind CSS & Framer Motion:** Diseño "Glassmorphism" con temáticas arcade. Animaciones fluidas, bordes brillantes y modales responsivos que imitan la retención y la calidad visual de juegos móviles Top Grossing (estilo Supercell).

## 🎮 Cómo Jugar

1. Inicia el juego con `npm run dev`.
2. Selecciona tu "Banda Sonora" y "Estilo de Espada" (Cosméticos).
3. Entra en modo **Cámara**: Aléjate un poco, levanta la mano, y usa tu dedo índice como sable láser.
4. **Modo Clásico**: 3 vidas, las piñas (bombas) te quitan una vida.
5. **Modo Árcade**: 60 segundos de tiempo libre para hacer combos gigantes, las piñas quitan tiempo.
6. ¡Rompe el récord y registra tu puntuación en la "Blockchain"!

## 🛠 Instalación y Desarrollo Local

```bash
# 1. Clona el repositorio
git clone https://github.com/CaBsCrypto/pizzaninja.git
cd pizzaninja

# 2. Instala las dependencias
npm install

# 3. Levanta el servidor de desarrollo en localhost:5173
npm run dev
```

---
*Construido como Prueba de Concepto Técnica. Las transacciones mostradas al finalizar la partida en esta versión son simulaciones visuales del comportamiento planificado en Soroban.*
