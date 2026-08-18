# 🎮 Requirement R3 & Testing Infrastructure Survey Report

**Project**: Slash Slice Arena  
**Explorer Agent**: Explorer 3 (`explorer_survey_r3`)  
**Target Milestone**: Survey R3 (Fullscreen Game-Over Screen, Overlay Hierarchy, Interactivity & Test Infrastructure)  
**Date**: 2026-08-18  

---

## 1. Executive Summary

A thorough architectural and source-code investigation of **Slash Slice Arena** was conducted to diagnose **Requirement R3: Fullscreen Game-Over Screen Rendering, Modal Transitions, Overlay z-index & Pointer-Events, and Test Infrastructure**.

### Key Findings
1. **Root Cause of the Black Screen in Fullscreen Mode**:  
   When the user toggles fullscreen, `PizzaCanvas.tsx` invokes `container.requestFullscreen()` on its internal `containerRef` (`<div ref={containerRef} ...>`). However, the Game Over and Score Record modal (`scoreRegistrationCard`) is defined in `App.tsx` and rendered in the DOM tree **outside** `PizzaCanvas` as a sibling element. Under the W3C Fullscreen standard and browser Top-Layer rendering, any DOM element outside the fullscreen element is invisible. When the game ends, `PizzaCanvas` hides its HUD and Main Menu (because `isRegistering === true`), leaving only an empty canvas inside the fullscreen container. The user is trapped on a completely black/empty screen without access to score submission, retry, or menu buttons.
2. **Overlay & Z-Index Breakdown**:  
   Multiple overlays exist across both `App.tsx` and `PizzaCanvas.tsx`. While in-game submodals (Armería, Tutorial, Ajustes) are contained inside `containerRef`, top-level overlays (Score Registration, Shop, Web3 Minting Success Modal, Stellar Hub Drawer) are mounted outside `containerRef`.
3. **Interactivity & Button Flow**:  
   The Game Over dialog supports two primary states: Web3 On-Chain submission (with a 3-step gas abstraction stepper) and Guest registration (with moniker input, save record, and skip options). When dismissed, `setPendingScore(null)` resets the state, but there is no direct "JUGAR DE NUEVO" (Instant Retry) button on the modal, forcing a two-step return to the menu.
4. **Build & Lint Setup**:  
   - Linting: `npm run lint` runs `tsc --noEmit` using `tsconfig.json`.
   - Building: `npm run build` runs `npx tsx copy-mediapipe-assets.js && vite build`.
   - Development: `npm run dev` serves on port 3000 with basic SSL for camera permissions.
5. **Testing Infrastructure**:  
   The project uses Node.js 24's native test runner (`node:test`, `node:assert/strict`) executed with `tsx` (`npm test` -> `tsx --test tests/e2e/*.test.ts`). An isolated in-memory Redis engine (`mockKvServer.ts`) and test harness (`testServer.ts`) provide robust testing for backend REST endpoints across 4 tiers. A dedicated test harness for R3 UI state transitions, Game Over lifecycle, and score sync can be seamlessly integrated.

---

## 2. Detailed Technical Breakdown: Fullscreen Game-Over Black Screen (R3)

### 2.1 DOM Hierarchy & Fullscreen Encapsulation Trap

```
#ninja-app-root (App.tsx)
├── <header> (z-40: Title, Shop Button, Wallet Button)
├── <main> (z-40: Main Container Workspace)
│   └── <div className="flex-1 ...">
│       ├── <Shop /> (Mounted only when showShop is true)
│       ├── <motion.div> (Minted Tx Modal, z-[110])
│       │
│       ├── ❌ <motion.div> (Score Registration Overlay, z-[100])
│       │      └── {scoreRegistrationCard}  <-- OUTSIDE FULLSCREEN ELEMENT!
│       │
│       └── <PizzaCanvas /> (Child component)
│           └── <div className="w-full h-full ...">
│               └── 👑 <div ref={containerRef}>  <-- FULLSCREEN ELEMENT!
│                   ├── {damageFlash && ...}
│                   ├── {isPlaying && <HUD Header ...>} (z-40)
│                   ├── <div className="relative flex-1 ...">
│                   │     └── <canvas ref={canvasRef} /> (z-10)
│                   ├── {!isPlaying && !isRegistering && <MainMenuOverlay />} (z-50)
│                   │     ├── 🗡️ Knives Modal (z-[100])
│                   │     ├── 📋 Rules Modal (z-[100])
│                   │     └── ⚙️ Settings Modal (z-[100])
│                   ├── {controlMode === 'camera' && <HandTracker />}
│                   └── {countdown !== null && <CountdownOverlay />} (z-50)
```

### 2.2 Chronological Execution Trace of the Failure

1. **Fullscreen Activation**:
   - In `src/components/PizzaCanvas.tsx` (lines 147–162):
     ```typescript
     const toggleFullscreen = async () => {
       const container = containerRef.current;
       if (!container) return;
       if (!isFullscreen) {
         await container.requestFullscreen();
       }
     };
     ```
   - The browser elevates `<div ref={containerRef}>` to the top layer (`:fullscreen`).

2. **Game Over Triggered**:
   - In `src/components/PizzaCanvas.tsx` (lines 1020–1049), the game loop timer or life deduction triggers:
     ```typescript
     const isGameOver = (stateRef.current.gameMode === 'arcade' && currentSecs <= 0) ||
                        (stateRef.current.gameMode === 'classic' && stateRef.current.lives <= 0) ||
                        (stateRef.current.lives <= 0);

     if (isGameOver) {
       clearInterval(clockInterval);
       setIsPlaying(false);
       playWebSound('gameover');
       onGameOver(
         stateRef.current.score, 
         elapsed, 
         stateRef.current.totalSlashes, 
         stateRef.current.slashHistory || [],
         stateRef.current.startTime,
         stateRef.current.gameMode
       );
     }
     ```

3. **React State Updates**:
   - In `src/App.tsx` (lines 223–244):
     ```typescript
     const handleGameOver = (finalScore, finalDuration, finalSlashes, slashHistory, gameStartTimestamp, gameMode) => {
       setShowShop(false);
       setPendingScore({
         score: finalScore,
         duration: finalDuration,
         slashes: finalSlashes,
         slashHistory,
         gameStartTimestamp,
         gameMode,
       });
       setChefName('');
     };
     ```
   - `pendingScore` is set.
   - `App.tsx` passes `isRegistering={pendingScore !== null}` (evaluating to `true`) to `PizzaCanvas`.

4. **DOM Visibility Breakdown in Fullscreen**:
   - In `App.tsx` (lines 733–745):
     `{pendingScore !== null && !isPlaying && <motion.div ...>{scoreRegistrationCard}</motion.div>}` is rendered in `App.tsx`.
     **Crucially, this is outside `<div ref={containerRef}>`. Because `<div ref={containerRef}>` is the browser's active fullscreen element, the browser completely ignores/hides everything outside of it.**
   - Inside `<div ref={containerRef}>`:
     - `isPlaying` is `false` -> HUD Header (`{isPlaying && ...}`) is hidden.
     - `isRegistering` is `true` -> Main Menu Overlay (`{!isPlaying && !isRegistering ...}`) is hidden (line 3094).
     - Result: Inside `<div ref={containerRef}>`, ONLY the empty canvas (`<canvas ref={canvasRef} />`) with dark slate background (`bg-slate-950`) is rendered.
   - The user experiences a **complete black screen freeze**, with no modal, no score, and no buttons.

---

## 3. Overlay Layers, Z-Index Hierarchy & Pointer-Events Inventory

| Component / Layer | Location | Parent Container | Z-Index | Pointer Events | Fullscreen Visible? |
|---|---|---|---|---|:---:|
| **Damage Flash Overlay** | `PizzaCanvas.tsx:2865` | `containerRef` | `z-50` | `none` | ✅ Yes |
| **In-Game HUD Header** | `PizzaCanvas.tsx:2870` | `containerRef` | `z-40` | `auto` (children) | ✅ Yes (when `isPlaying`) |
| **Volume Settings Popover** | `PizzaCanvas.tsx:2955` | `containerRef` (HUD) | `z-50` | `auto` | ✅ Yes |
| **Game Canvas (`<canvas>`)** | `PizzaCanvas.tsx:3075` | `containerRef` | `z-10` | `auto` | ✅ Yes |
| **Main Menu Overlay** | `PizzaCanvas.tsx:3095` | `containerRef` | `z-50` | `auto` | ✅ Yes (when not playing & not registering) |
| **Armería / Tutorial / Settings Modals** | `PizzaCanvas.tsx:3224` | `containerRef` | `z-[100]` | `auto` | ✅ Yes |
| **Countdown Overlay (3..2..1..GO)** | `PizzaCanvas.tsx:3444` | `containerRef` | `z-50` | `none` | ✅ Yes |
| **HandTracker Webcam Feed** | `PizzaCanvas.tsx:3407` | `containerRef` | `z-30`/`z-45` | `auto` | ✅ Yes |
| **Score Registration Card (`scoreRegistrationCard`)** | `App.tsx:735` | `App.tsx` `<main>` | `z-[100]` | `auto` | ❌ **NO (Blocked by Fullscreen)** |
| **Web3 NFT Minted Modal** | `App.tsx:698` | `App.tsx` `<main>` | `z-[110]` | `auto` | ❌ **NO (Blocked by Fullscreen)** |
| **Shop Modal (`<Shop />`)** | `App.tsx:685` | `App.tsx` `<main>` | `z-[150]` | `auto` | ❌ **NO (Blocked by Fullscreen)** |
| **Stellar Hub Slide-out Drawer** | `App.tsx:866` | `#ninja-app-root` | `z-50` | `auto` | ❌ **NO (Blocked by Fullscreen)** |
| **Toast HUD** | `App.tsx:764` | `#ninja-app-root` | `z-50` | `auto` | ❌ **NO (Blocked by Fullscreen)** |
| **Landscape Warning Overlay** | `App.tsx:785` | `#ninja-app-root` | `z-50` | `auto` | ❌ **NO (Blocked by Fullscreen)** |

---

## 4. Score Record / Leaderboard Dialogs & Button Interactivity

### 4.1 Dialog Flow States in `scoreRegistrationCard`

1. **Guest / Anonymous User State** (`!walletState.connected`):
   - **Moniker Input**: `<input id="chef-name" maxLength={12} placeholder="CHEF_NINJA" value={chefName} ... required />` (line 582).
   - **Save Button**: `<button type="submit" className="btn-clash-blue ...">GUARDAR RÉCORD <ArrowRight /></button>` (line 592).
     - Submits `handleRegisterScore(e)` -> saves to `slash_slice_scores_v2` in `localStorage` -> sets `pendingScore = null`.
   - **Skip Button**: `<button type="button" onClick={() => setPendingScore(null)}>Omitir registro y volver al menú</button>` (line 596).
     - Immediately resets `pendingScore = null` -> returns to Main Menu.

2. **Connected Web3 Wallet State** (`walletState.connected === true`):
   - **Idle Stage**:
     - Shows public key / domain name.
     - **Button**: `INMORTALIZAR RÉCORD` (line 561) -> builds Soroban transaction signature, sets `mintingStep = 'signing'`, sponsors gas (`mintingStep = 'sponsoring'`), calls `/api/score` (`mintingStep = 'registering'`).
     - **Button**: `Cambiar Nombre` (line 566) -> disconnects wallet state for moniker entry.
     - **Button**: `Omitir` (line 569) -> sets `pendingScore = null`.
   - **In-Progress Stepper Stage**:
     - Visual animated stepper with `Loader2`, `CheckCircle2`, and `Hourglass`.
   - **Completed Stage**:
     - Shows transaction hash.
     - **Button**: `¡EXCELENTE, VOLVER!` (line 434) -> sets `pendingScore = null` and `mintingStep = 'idle'`.
   - **Error Stage**:
     - Shows error alert.
     - **Button**: `REINTENTAR` (line 448) -> sets `mintingStep = 'idle'`.
     - **Button**: `CANCELAR` (line 455) -> sets `pendingScore = null` and `mintingStep = 'idle'`.

### 4.2 UX Opportunity: Direct "Retry / Jugar de Nuevo" Action
Currently, restarting a game requires:
1. Dismissing `pendingScore` (clicking Save or Skip).
2. Waiting for Main Menu to render.
3. Clicking "JUGAR NORMAL" or "JUGAR CÁMARA".
Providing an optional direct "REINTENTAR / JUGAR DE NUEVO" button in the Game Over modal would improve replayability and game flow.

---

## 5. Build, Lint & Runtime Configuration Analysis

### 5.1 `package.json` Scripts
- `"dev"`: `"npx tsx copy-mediapipe-assets.js && vite --port=3000 --host=0.0.0.0"`
- `"build"`: `"npx tsx copy-mediapipe-assets.js && vite build"`
- `"lint"`: `"tsc --noEmit"`
- `"test"`: `"tsx --test tests/e2e/*.test.ts"`
- `"dev:api"`: `"tsx src/api/server.ts"`
- `"preview"`: `"vite preview"`
- `"clean"`: `"rm -rf dist server.js"`

### 5.2 TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

### 5.3 Vite Configuration (`vite.config.ts`)
- Configures Tailwind CSS v4 (`@tailwindcss/vite`).
- Configures React plugin (`@vitejs/plugin-react`).
- Polyfills Node globals (`Buffer`, `process`) via `vite-plugin-node-polyfills`.
- Basic SSL enabled via `@vitejs/plugin-basic-ssl` to support `navigator.mediaDevices.getUserMedia` across LAN/IP devices.
- Path aliases: `@` mapped to workspace root.

---

## 6. Existing Automated Tests & Test Infrastructure

### 6.1 Test Framework Architecture
- **Framework**: Node.js native test runner (`node:test`, `node:assert/strict`).
- **Runner Execution**: `tsx --test tests/e2e/*.test.ts` (TypeScript on-the-fly execution without precompilation).
- **Zero-Dependency Mock Engine**: `tests/helpers/mockKvServer.ts` emulates Upstash/Vercel KV REST API (`/zadd`, `/zrange`, `/zrevrank`, `/hset`, `/hget`, `/pipeline`) in memory on a dynamic local port (`http://127.0.0.1:PORT`).
- **Server Harness**: `tests/helpers/testServer.ts` mounts Express server with endpoints `/api/user`, `/api/leaderboard`, `/api/leaderboard/rank`, and `/api/score`.

### 6.2 Existing Test Suite Catalog
1. `tests/e2e/tier1_features.test.ts`: 25 feature coverage tests for user registration, score submissions, and leaderboard retrieval.
2. `tests/e2e/tier2_boundaries.test.ts`: 15 boundary tests (invalid Stellar keys, bad usernames, bounds checking, pagination limits).
3. `tests/e2e/tier3_interactions.test.ts`: End-to-end lifecycle test (register -> post score -> rank check -> profile update).
4. `tests/e2e/tier4_realworld.test.ts`: 5 multi-user competition scenarios across arcade & classic modes.
5. `tests/e2e/m3_score_sync_empirical.test.ts`: Empirical verification for ISO week/date formatters, multi-period ZSET sync, and guest score records.
6. `tests/empirical_m3_stress.test.ts` & `tests/adversarial_m3_stress.test.ts`: Adversarial stress tests.

---

## 7. Strategic Recommendations for Fixing Requirement R3

To completely resolve Bug 3 (R3) with 100% reliability and zero regressions, implement the following changes:

### Solution Architecture: Unified Fullscreen Containment & Game-Over Overlay

There are two clean, robust architectural solutions:

#### Recommended Approach A: Fullscreen-Safe Overlay Hierarchy (Passing Overlays into `PizzaCanvas` or Rendering Inside `containerRef`)
1. **Pass `scoreRegistrationOverlay` / modals into `PizzaCanvas` (or render Game-Over UI directly inside `containerRef`)**:
   - In `PizzaCanvas.tsx`, accept `scoreRegistrationContent?: React.ReactNode` (or render the Game Over modal inside `<div ref={containerRef}>`).
   - When `isRegistering` is `true`, render the Game Over overlay **inside** `<div ref={containerRef}>` at `z-[100]`.
   - Because it resides inside the active fullscreen element, the Game Over UI is immediately visible, high-contrast, fully responsive, and clickable in fullscreen mode!

#### Complementary Approach B: Fullscreen Exit Guard / App-Root Fullscreen
1. **Option B1 (Clean Exit on Game Over)**:  
   When `isGameOver` triggers in `PizzaCanvas.tsx`:
   ```typescript
   if (document.fullscreenElement) {
     try {
       await (document.exitFullscreen ? document.exitFullscreen() : (document as any).webkitExitFullscreen?.());
     } catch (e) {
       console.warn("Fullscreen exit on game over skipped:", e);
     }
   }
   ```
   *Note: While exiting fullscreen avoids the black screen, Approach A is superior for user experience because players in fullscreen mode typically prefer to stay in fullscreen and see the Game Over HUD uninterrupted.*

2. **Option B2 (Fullscreen on Common App Container)**:  
   Target `#ninja-app-root` (or the common wrapper containing both the canvas and all overlays) when requesting fullscreen.

### Solution Matrix Summary

```typescript
// Proposed structure inside PizzaCanvas.tsx:
<div ref={containerRef} ...>
  {/* HUD Header */}
  {isPlaying && <HUDHeader ... />}

  {/* Canvas */}
  <div className="relative flex-1 ...">
    <canvas ref={canvasRef} ... />
  </div>

  {/* Game Over / Score Record Overlay (RENDERED INSIDE containerRef!) */}
  {isRegistering && (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 rounded-3xl pointer-events-auto">
      {scoreRegistrationContent || (
        /* Score Registration / Game Over Card */
      )}
    </div>
  )}

  {/* Main Menu Overlay */}
  {!isPlaying && !isRegistering && !(controlMode === 'camera' && handDetected) && (
    <MainMenuOverlay ... />
  )}
</div>
```

---

## 8. Proposed Automated Test Suite for R3

Create a new test file: `tests/e2e/r3_fullscreen_gameover.test.ts` verifying:
1. **Game Over Lifecycle & State Invariants**:
   - Verify that when game over conditions are met (`lives <= 0` or `timeLeft <= 0`), the game transition emits correct score, slashes, duration, and replay points.
2. **Score Registration Payload & Persistence**:
   - Verify guest moniker submission formats (`CHEF_NINJA`, default `ANÓNIMO`).
   - Verify storage payload serialization and local cache updates.
3. **Modal Reset & Navigation Invariants**:
   - Verify that dismissing the modal (`pendingScore = null`) restores the idle menu state (`isPlaying = false`, `isRegistering = false`).
4. **Fullscreen Containment Contract**:
   - Verify DOM tree structure guarantees overlay elements are located within the fullscreen target or properly ported.

---

## 9. Conclusion

The root cause of Requirement R3 (the fullscreen Game-Over black screen) has been definitively identified and documented with exact line references. All build, lint, and test runner configurations have been analyzed. The proposed solution seamlessly fixes the DOM boundary mismatch, guarantees immediate visibility of the Game Over UI, preserves full interactivity for all buttons, and aligns with the project's native test infrastructure.
