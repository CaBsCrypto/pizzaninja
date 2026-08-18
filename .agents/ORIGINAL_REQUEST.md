# Original User Request

## Initial Request — 2026-08-11T00:19:34Z

Build a REST API serverless suite in TypeScript for user registration, user profile management, and multi-period filtered leaderboards (Arcade/Classic, All-Time/Weekly/Daily) backed by Vercel KV (Redis) and integrated into Slash Slice Arena.

Working directory: C:\Users\MGC\Documents\antigravity\blissful-hawking
Integrity mode: development

## Requirements

### R1. User Registration & Profile API (`/api/user`)
Implement `POST /api/user` and `GET /api/user`. `POST` registers a Stellar public key (`G...`), unique username (3-15 chars, alphanumeric + `_`), avatar, and Privy DID into Vercel KV, enforcing username uniqueness via Redis index. `GET` retrieves user profiles, high scores, and global rank.

### R2. Advanced Filtered Leaderboard API (`/api/leaderboard`)
Implement `GET /api/leaderboard` and `GET /api/leaderboard/rank`. Allow filtering by mode (`arcade` | `classic`), timeframe (`alltime` | `weekly` | `daily`), and pagination (`limit`, `page`). Return ranked player arrays with metadata and calculate exact player rank and percentiles.

### R3. Score Sync & UI Integration
Update `api/score.ts` to sync submissions with new Redis keys (`slashslice:leaderboard:<mode>:alltime` & `slashslice:user:<pubkey>`). Update `StellarHub.tsx` to handle profile registration upon Web3 wallet login.

## Acceptance Criteria

### API Functionality & Verification
- [ ] `POST /api/user` rejects invalid Stellar keys, non-alphanumeric usernames, or duplicate usernames.
- [ ] `GET /api/leaderboard` returns correctly sorted rankings filtered by mode and period.
- [ ] All code compiles without errors via `pnpm build`.
- [ ] OpenAPI documentation (`docs/API_REFERENCE.md`) is updated with `/api/user` and `/api/leaderboard`.

## Follow-up — 2026-08-11T04:55:46Z

SpicyCrust Game Ecosystem API: A lightweight, secure, and extensible REST API written in PHP/MySQL for managing player identities, score submissions, game leaderboards, and competitive seasons across all SpicyCrust web games.

Working directory: C:\Users\MGC\Documents\antigravity\blissful-hawking\spicycrust-game-api
Integrity mode: development

## Requirements

### R1. Core Ecosystem Data & API Architecture
Build a modular PHP/MySQL HTTP REST API (/api/v1/...) using PDO prepared statements to handle game registration (games table with slug & api_key_hash), cross-game player identity (players table with external_id & nickname), score submissions (scores table with numeric score and JSON metadata), leaderboards (per-game and global), and competitive seasons (seasons table).

### R2. Security, Authentication & Abuse Prevention
Implement game API key hashing/verification (Authorization: Bearer <token>), CORS origin control, HTTP request payload validation (types, limits, JSON formatting), rate limiting (filesystem/MySQL based), and input sanitization to block SQL injection, XSS, and trivial replay/score manipulation without exposing sensitive secrets in errors or repository code.

### R3. Documentation, Seeding & Tests
Provide database schema scripts (schema.sql, seed.sql), clear environment configuration (.env.example), complete documentation (README.md, docs/API.md, docs/SECURITY.md, docs/ARCHITECTURE.md), and automated test suites verifying all endpoints and error cases.

## Acceptance Criteria

### API Endpoints & Functionality
- [ ] GET /api/v1/health returns {"success": true, "data": {"status": "ok"}}
- [ ] POST /api/v1/scores accepts scores authenticated via game API key and stores numeric score + JSON metadata
- [ ] GET /api/v1/leaderboard returns per-game rankings with player nicknames, ranks, and scores
- [ ] GET /api/v1/leaderboard/global returns global ecosystem rankings
- [ ] GET /api/v1/seasons and /api/v1/seasons/current return active/past season details

### Security & Quality
- [ ] Invalid requests (missing headers, bad JSON, unauthenticated games, invalid emails/scores) return appropriate HTTP status codes (400, 401, 403, 404, 422, 429) and standard JSON error envelopes
- [ ] Database access exclusively uses PDO prepared statements
- [ ] Rate limiting blocks excessive requests with 429 Too Many Requests
- [ ] Test suite runs automatically and passes for all core endpoints

## Follow-up — 2026-08-18T20:29:34Z

Corregir y auditar los 3 bugs críticos reportados en el juego *Slash Slice Arena* (responsividad en móviles, persistencia indeseada del estado de cámara y pantalla negra en fin de partida en modo fullscreen), asegurando validación integral de la experiencia de usuario y pruebas automatizadas.

Working directory: C:\Users\MGC\Documents\antigravity\blissful-hawking
Integrity mode: development

## Requirements

### R1. Responsive Canvas & Mobile Viewport Scaling (Bug 1)
- Corregir el dimensionamiento del contenedor del lienzo de juego (canvas/iframe) en dispositivos móviles y smartphones (pantalla vertical/horizontal) para que no se colapse ni aparezca reducido en el centro.
- Asegurar que todos los elementos de la interfaz de usuario (botones de inicio, navegación, selección de cuchillos y ajustes) sean plenamente visibles, accesibles y táctiles en pantallas pequeñas.

### R2. Desactivación y Limpieza de Estado de Cámara (Bug 2)
- Al salir de una partida en "Modo Cámara" o al regresar al menú principal, apagar y limpiar de forma definitiva el sensor y las instancias de MediaPipe/webcam.
- Al iniciar una partida en "Modo Normal" o al omitir el registro, asegurar que el juego no quede bloqueado solicitando detección de mano ni muestre el estado "Detección Perdida".

### R3. Renderizado y Transición Inmediata de UI de Fin de Partida en Pantalla Completa (Bug 3)
- Garantizar que al terminar la partida en modo pantalla completa, la interfaz de fin de partida (registro de récord / puntuación / Game Over) se visualice inmediatamente sin pantallas negras ni capas opacas que oculten el contenido.
- El usuario debe poder interactuar de inmediato con el formulario de puntuación o el botón de volver al menú sin tener que buscar controles ocultos.

## Acceptance Criteria

### Criterios de Aceptación y Verificación
- [ ] **Build & Lint Check**: `npm run build` y `npm run lint` se ejecutan sin errores de compilación ni advertencias críticas de TypeScript/Rollup.
- [ ] **Mobile Layout**: El contenedor del juego en resoluciones móviles (ej. 375x667, 390x844, 412x915) ocupa el viewport disponible con los botones de menú y modal de registro centrados y clickeables.
- [ ] **Camera Transition**: Al alternar de Modo Cámara a Modo Normal, la cámara se apaga (`stream.getTracks().forEach(t => t.stop())`), `isPaused` se resetea a `false` y el juego responde al ratón/toque sin avisos de detección perdida.
- [ ] **Fullscreen Game Over**: Al agotarse el tiempo o vidas en modo pantalla completa, la UI de resultados/guardado de récord aparece visible y legible al 100% de inmediato.


