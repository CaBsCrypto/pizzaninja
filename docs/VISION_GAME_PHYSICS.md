# 👁️ Computer Vision & Game Physics Engine

## 📋 Executive Summary

**Slash Slice Arena** features an in-browser spatial interaction engine driven by **Google MediaPipe Hands** (Edge AI) and a custom **HTML5 Canvas 2D Physics Engine**.

Players control the game by moving their hands in front of a standard webcam. The index fingertip acts as a blade tip, casting continuous slicing trails in 2D space. The physics engine handles split-body calculations, angular momentum, particle explosion systems, and procedural sound generation at a constant **60 FPS**.

---

## 🖐️ MediaPipe Hand Tracking & Swipe Mechanics

### Landmark Mapping

MediaPipe Hands returns 21 3D keypoints per detected hand. Slash Slice Arena extracts **Landmark 8 (Index Finger Tip)** as the primary blade origin.

```
                  (8) Index Tip  <--- Blade Point
                   │
                  (7) Index DIP
                   │
                  (6) Index PIP
                   │
                  (5) Index MCP
                   │
  (4) Thumb Tip    │
        \          │       (12) Middle Tip
         (3)      (0) Wrist
```

### Motion Vector Interpolation & Swipe Validation

To prevent accidental triggers from minor hand jitter or hovering over the Start Pizza in camera mode, the game enforces a **velocity and distance threshold algorithm**:

```typescript
// Slicing validation logic in HandTracker.tsx and PizzaCanvas.tsx
const dx = currentX - prevX;
const dy = currentY - prevY;
const dist = Math.hypot(dx, dy); // Euclidean distance

// 1. Raw spatial sweep threshold for start pizza calibration
const isIntentionalSwipe = dist > 35; // Minimum 35px continuous movement

// 2. Trailing history distance check
if (swipeLen > 25 && isIntentionalSwipe) {
  triggerPizzaSlice(currentX, currentY);
}
```

---

## 🍕 Particle System & Split Geometry Physics

When a slice intersects a flying pizza object, the entity is destroyed and replaced by two half-slice bodies with opposite tangential velocities, accompanied by a particle burst.

### Particle Emission Profiles

| Particle Type | Visual Properties | Physics Behavior | Count per Slice |
| :--- | :--- | :--- | :--- |
| **Crust Chunk** | Hexagons / Triangles (`#D62828`, `#F4A261`) | Heavy mass, high gravity ($g = 0.45$), rotational drag | 8 - 12 fragments |
| **Sauce Splat** | Circles (`#B91C1C`) with opacity decay | Radial explosion velocity, soft gravity ($g = 0.15$) | 12 - 16 droplets |
| **Cheese Melt** | Oblong ellipses (`#E9C46A`) | Light mass, slow float velocity, stretch transform | 6 - 10 threads |

### Mathematical Collision Detection

Slice detection uses continuous line-segment to circle intersection checks between the current frame's blade vector $\vec{P_1P_2}$ and the pizza center $C(x,y)$ with radius $R$:

$$d = \frac{|(y_2 - y_1)x_0 - (x_2 - x_1)y_0 + x_2y_1 - y_2x_1|}{\sqrt{(y_2 - y_1)^2 + (x_2 - x_1)^2}}$$

If $d \le R$ and the projection of $C$ falls within segment $\overline{P_1P_2}$, a valid slice occurs.

---

## 🔊 Procedural WebAudio Synthesizer

Slash Slice Arena generates 100% of its sound effects procedurally via the browser's `AudioContext` API (`src/services/sound.ts`), eliminating MP3 download latency and network overhead.

### Sound FX Synthesis Recipes

```typescript
// Procedural Slash Sound Generator
const ctx = getAudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

// Frequency ramp down to simulate air blade velocity (whoosh)
osc.type = 'sine';
osc.frequency.setValueAtTime(800, ctx.currentTime);
osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);

// Exponential volume decay
gain.gain.setValueAtTime(0.3, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

osc.connect(gain);
gain.connect(ctx.destination);
osc.start();
osc.stop(ctx.currentTime + 0.12);
```

| FX Event | Oscillator Type | Frequency Range | Envelope Duration |
| :--- | :--- | :--- | :--- |
| **Blade Slash** | Exponential `sine` | $800 \text{ Hz} \to 120 \text{ Hz}$ | 120 ms |
| **Pizza Splat** | White Noise + `triangle` | $300 \text{ Hz} \to 40 \text{ Hz}$ | 180 ms |
| **Bomb Burst** | Square + Low-Pass Filter | $150 \text{ Hz} \to 30 \text{ Hz}$ | 450 ms |
| **Combo Multiplier**| Harmonics `sine` sequence | $523 \text{ Hz} \to 659 \text{ Hz} \to 784 \text{ Hz}$ | 300 ms (Major Chord) |
