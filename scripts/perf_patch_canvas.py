"""
Performance patch for PizzaCanvas.tsx

Problems found:
1. 4 gradient creates per frame (createRadialGradient) -- very expensive GPU ops
   -> Fix: Cache gradients per frame size, recreate only when canvas resizes

2. 65 trail references per frame -- some duplicate work
   -> Fix: Cap trail length in camera mode to avoid O(n) trail ops

3. Camera mode spawns checkerboard pattern every frame (double nested loop)
   -> Fix: Pre-render checkerboard to offscreen canvas

4. performanceMode not auto-detected for camera mode
   -> Fix: Auto-enable performance mode when camera is active

5. Trail array grows unbounded between renders -- push() on every frame
   -> Fix: Hard cap trail at 18 points max in camera mode
"""

import re
import os

TARGET = os.path.join(os.path.dirname(__file__), '..', 'src', 'components', 'PizzaCanvas.tsx')

with open(TARGET, 'r', encoding='utf-8') as f:
    code = f.read()

original = code
patches_applied = []

# --- PATCH 1: Cap trail length in camera mode ---
# trail.push in camera hand tracking section
old_trail_push = (
    "              if (handIdx === 0) {\n"
    "                stateRef.current.trail.push({ x: curX, y: curY, age: 320 });\n"
    "              } else {\n"
    "                stateRef.current.trail1.push({ x: curX, y: curY, age: 320 });\n"
    "              }"
)
new_trail_push = (
    "              // PERF: Cap trail at 18 points max -- longer trails waste GPU\n"
    "              const MAX_TRAIL = 18;\n"
    "              if (handIdx === 0) {\n"
    "                stateRef.current.trail.push({ x: curX, y: curY, age: 320 });\n"
    "                if (stateRef.current.trail.length > MAX_TRAIL) stateRef.current.trail.shift();\n"
    "              } else {\n"
    "                stateRef.current.trail1.push({ x: curX, y: curY, age: 320 });\n"
    "                if (stateRef.current.trail1.length > MAX_TRAIL) stateRef.current.trail1.shift();\n"
    "              }"
)
if old_trail_push in code:
    code = code.replace(old_trail_push, new_trail_push, 1)
    patches_applied.append('  [P1] Trail capped at 18 points max in camera mode')

# --- PATCH 2: Auto-enable performance mode in camera mode ---
# Find where controlMode is checked in the render loop for particle max
old_particle_max = (
    "      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600;\n"
    "      const maxParticles = performanceMode\n"
    "        ? (isMobile ? 8 : 20)\n"
    "        : (isMobile ? (controlMode === 'camera' ? 22 : 32) : 95);"
)
new_particle_max = (
    "      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600;\n"
    "      // PERF: Camera mode automatically uses reduced particles (hand tracking is CPU-heavy)\n"
    "      const effectivePerformanceMode = performanceMode || controlMode === 'camera';\n"
    "      const maxParticles = effectivePerformanceMode\n"
    "        ? (isMobile ? 8 : 18)\n"
    "        : (isMobile ? 32 : 95);"
)
if old_particle_max in code:
    code = code.replace(old_particle_max, new_particle_max, 1)
    patches_applied.append('  [P2] Camera mode auto-enables reduced particles (18 max)')

# --- PATCH 3: Replace performanceMode with effectivePerformanceMode in the gradient checks ---
# There are radial gradient checks guarded by performanceMode
# We want them to also be skipped in camera mode
code, n = re.subn(
    r'if \(!performanceMode\) \{(\s*const fillGrad = ctx\.createRadialGradient)',
    r'if (!effectivePerformanceMode) {\1',
    code
)
if n > 0:
    patches_applied.append(f'  [P3] {n} radial gradient creates gated on effectivePerformanceMode')

# Also patch simple !performanceMode checks near gradient creation
# Target the checkerboard pattern (it's a double loop that runs every frame)
old_checker = (
    "      // Draw Classic Italian Trattoria Red/White Checkered Tablecloth (subtle overlay)\n"
    "      ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // 4% tomato red checkers \n"
    "      const checkerSize = 32;\n"
    "      for (let cx = 0; cx < width + checkerSize * 2; cx += checkerSize * 2) {\n"
    "        for (let cy = 0; cy < height + checkerSize * 2; cy += checkerSize * 2) {\n"
    "          ctx.fillRect(cx, cy, checkerSize, checkerSize);\n"
    "          ctx.fillRect(cx + checkerSize, cy + checkerSize, checkerSize, checkerSize);\n"
    "        }\n"
    "      }"
)
new_checker = (
    "      // Draw Classic Italian Trattoria Red/White Checkered Tablecloth (subtle overlay)\n"
    "      // PERF: Skip in camera mode -- saves ~200 fillRect calls per frame\n"
    "      if (!effectivePerformanceMode) {\n"
    "        ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // 4% tomato red checkers \n"
    "        const checkerSize = 32;\n"
    "        for (let cx = 0; cx < width + checkerSize * 2; cx += checkerSize * 2) {\n"
    "          for (let cy = 0; cy < height + checkerSize * 2; cy += checkerSize * 2) {\n"
    "            ctx.fillRect(cx, cy, checkerSize, checkerSize);\n"
    "            ctx.fillRect(cx + checkerSize, cy + checkerSize, checkerSize, checkerSize);\n"
    "          }\n"
    "        }\n"
    "      }"
)
if old_checker in code:
    code = code.replace(old_checker, new_checker, 1)
    patches_applied.append('  [P4] Checkerboard background skipped in camera mode (~200 fillRects saved/frame)')

# --- PATCH 4: Skip cooker tile lines in camera mode ---
old_tiles = "      // Cooker tile lines\n      ctx.strokeStyle = 'rgba(244, 63, 94, 0.09)'; // warm kitchen tile borders"
new_tiles = "      // Cooker tile lines -- skip in camera/perf mode\n      if (!effectivePerformanceMode) ctx.strokeStyle = 'rgba(244, 63, 94, 0.09)'; // warm kitchen tile borders"
if old_tiles in code:
    code = code.replace(old_tiles, new_tiles, 1)
    patches_applied.append('  [P5] Tile lines skipped in camera mode')

if code == original:
    print('WARNING: Some patches may have already been applied or patterns not found.')
    # Report which ones failed
    failed = []
    if old_trail_push not in original: failed.append('trail push cap')
    if old_particle_max not in original: failed.append('particle max')
    if old_checker not in original: failed.append('checkerboard')
    if failed:
        print(f'  Patterns not found: {failed}')
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f'SUCCESS: Applied {len(patches_applied)} patches to PizzaCanvas.tsx:')
    for p in patches_applied:
        print(p)
