# 🗺️ Hoja de Ruta (Roadmap) - Slash Slice Arena

Este documento define la visión a largo plazo y las próximas iteraciones para **Slash Slice Arena**. El objetivo es tener una guía de alto nivel que evite la "ceguera de taller" y mantenga el desarrollo enfocado en hitos (milestones) claros y medibles.

---

## Fase 1: Consolidación del PoC (Prueba de Concepto) 🟢 *[Completado / Actual]*
*Objetivo: Validar la idea con una demo interactiva, fluida y visualmente atractiva.*

- `[x]` **Visión Artificial Básica:** Detección de colisiones mediante MediaPipe (cámara).
- `[x]` **UI/UX AAA:** Menús estilo "Clash Royale", animaciones fluidas, retroalimentación visual (Glassmorphism).
- `[x]` **Web3 Invisible:** Autenticación con Gmail a través de Web3Auth (Stellar).
- `[x]` **Simulación de Blockchain:** Mockups de minteo de NFTs y guardado de puntuaciones en Soroban para demostraciones.
- `[x]` **Documentación Inicial:** `README.md` estructurado.

---

## Fase 2: Integración Web3 Real (Contratos Inteligentes) 🟡 *[Próxima Iteración]*
*Objetivo: Reemplazar la "simulación" con código real en la blockchain de Stellar (Soroban).*

1. **Configuración del Entorno Rust/Soroban:**
   - Crear un workspace de Rust (`/contracts`).
   - Configurar la testnet de Stellar.
2. **Contrato de Leaderboard (Registro de Puntuaciones):**
   - Programar un Smart Contract que reciba la puntuación, valide la firma de la billetera y la guarde on-chain.
   - Conectar el frontend (`App.tsx`) para interactuar con este contrato usando `stellar-sdk`.
3. **Colección NFT Básica (Cosméticos):**
   - Emitir un token no fungible (NFT) para el jugador cuando alcance ciertos hitos (ej. > 500 puntos).
   - Mostrar los NFTs reales en el inventario del jugador.

---

## Fase 3: Expansión de Jugabilidad y Economía In-Game 🔵 *[Mediano Plazo]*
*Objetivo: Aumentar la retención de los usuarios mediante progresión y variedad mecánica.*

1. **Economía In-Game (Token $SLICE):**
   - Sistema de recompensas: ganar fracciones de $SLICE por jugar.
   - Tienda interna para comprar **Skins de Espadas**, **Mascotas**, o **Estelas de corte** usando el token.
2. **Nuevas Mecánicas Core:**
   - **Power-Ups:** Tiempo congelado, imán de pizzas, espadas dobles.
   - **Jefes (Boss Fights):** Pizzas gigantes con escudos que requieren múltiples cortes rápidos o patrones específicos.
3. **Sistema de Vidas y Energía:**
   - Limitar las partidas diarias (ej. 5 vidas máximo), recargables mediante micro-pagos en XLM o esperando tiempo.

---

## Fase 4: Modo Multijugador y Backend Competitivo 🟣 *[Largo Plazo]*
*Objetivo: Crear un ecosistema social competitivo (PvP).*

1. **Backend en Go (Golang):**
   - Desplegar el servidor en Go usando WebSockets para emparejamiento (Matchmaking).
2. **Batallas 1v1 en Tiempo Real:**
   - Los jugadores compiten simultáneamente viendo la "sombra" de los cortes del rival.
   - El que consiga más puntos en 60 segundos se lleva el bote de tokens apostados.
3. **Torneos Semanales On-Chain:**
   - Distribuir grandes premios usando Smart Contracts a los líderes de la tabla al final de la semana.

---

## Fase 5: Producción, Optimización y Escalamiento 🟠 *[Fase Final]*
*Objetivo: Lanzamiento comercial y captación masiva de usuarios.*

1. **Optimización de MediaPipe (WASM/WebGPU):**
   - Migrar la detección de manos a un hilo de procesamiento (Web Worker) para garantizar 60 FPS estables incluso en móviles de gama baja.
2. **Progressive Web App (PWA) / Móvil Nativo:**
   - Hacer el juego instalable desde el navegador web.
   - Empaquetar usando Capacitor/Tauri para publicarlo en App Store y Google Play.
3. **Analíticas y Retención:**
   - Integrar Mixpanel/Google Analytics para medir el tiempo de juego, caídas de FPS y puntos de abandono.

---

### 📝 Cómo usar este Roadmap
- Antes de iniciar una nueva característica, pregúntate: *"¿Esto pertenece a nuestra fase actual?"*
- Si la respuesta es no, anótalo como una sub-tarea de una fase futura y mantén el enfoque.
- Este documento es vivo y debe actualizarse si el feedback de los usuarios cambia la dirección del producto.
