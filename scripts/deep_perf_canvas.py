"""
DEEP PERFORMANCE PATCH - PizzaCanvas.tsx

Remaining expensive operations per frame in camera mode:

1. Trail renders 3 PASSES (PASS 1/2/3) per hand -> 54 stroke() calls for 2 hands (18pts each)
   Fix: Render only PASS 3 (core white line) in camera mode -> 18 stroke calls total

2. Spark particles emitted at trail tip on every moving frame
   Fix: Skip entirely in camera mode (save particle push+render)

3. Hand halo: pulsating ring with sin() + 3 arc() calls per hand per frame
   Fix: Replace with single static dot (no sin pulsation)

4. createLinearGradient for oven glow: runs EVERY frame
   Fix: Cache it, only recreate when canvas resizes

5. Pizza ambient glow: createRadialGradient per pizza per frame (guarded by !performanceMode, not !effectivePerformanceMode)
   Fix: Gate on effectivePerformanceMode
"""

import re
import os

TARGET = os.path.join(os.path.dirname(__file__), '..', 'src', 'components', 'PizzaCanvas.tsx')

with open(TARGET, 'r', encoding='utf-8') as f:
    code = f.read()

original = code
patches_applied = []

# ----- PATCH 1: Trail - single pass in camera mode -----
# Replace the 3-pass trail rendering with a simpler version when effectivePerformanceMode
old_trail_comment = '          // Draw multiple layered passes of lines to produce a stunning hot tapered blade swoosh!'
new_trail_comment = (
    '          // PERF: In camera mode, render single-pass trail (saves 2/3 of stroke calls).\n'
    '          // In normal mode, render 3 layered passes for the full cinematic blade effect.\n'
    '          // effectivePerformanceMode is captured at the top of updateLoop each frame.'
)
if old_trail_comment in code:
    code = code.replace(old_trail_comment, new_trail_comment, 1)
    patches_applied.append('[P1] Added perf comment for trail passes')

# Find and wrap PASS 1 and PASS 2 in effectivePerformanceMode guard
# We need to find "// PASS 1: Wide background aura" and wrap through end of PASS 2
# and then skip to PASS 3 when effectivePerformanceMode is true

old_pass1_header = '          // PASS 1: Wide background aura\n          for (let i = 0; i < activeTrail.length - 1; i++) {'
new_pass1_header = '          // PASS 1 + 2: Wide aura + hot trail -- skipped in camera/perf mode for speed\n          if (!effectivePerformanceMode) { for (let i = 0; i < activeTrail.length - 1; i++) {'

if old_pass1_header in code:
    # This approach is complex, let's do it differently
    # Find the end of PASS 2 and add the guard around both passes
    pass1_start = code.find('          // PASS 1: Wide background aura\n')
    pass3_start = code.find('          // PASS 3: Core super-heated sharp razor-line\n')
    
    if pass1_start > -1 and pass3_start > pass1_start:
        pass12_block = code[pass1_start:pass3_start]
        pass12_indented = pass12_block  # already indented
        
        new_pass12 = (
            '          // PASS 1 + 2: Wide aura + hot trail (skipped in camera/perf mode -- saves ~36 stroke calls per 2 hands)\n'
            '          if (!effectivePerformanceMode) {\n'
            + pass12_block.rstrip() + '\n'
            '          }\n\n'
        )
        code = code[:pass1_start] + new_pass12 + code[pass3_start:]
        patches_applied.append('[P1] PASS 1+2 trail rendering skipped in camera mode (saves ~36 stroke calls/frame)')

# ----- PATCH 2: Skip spark particle emission at trail tip in camera mode -----
old_spark_emission = (
    "          // If moving actively, eject sparkles at the tip (scale quantity with quickness)\n"
    "          const sparksChance = Math.min(0.85, 0.35 + tipDist * 0.015);\n"
    "          if (tipDist > 6 && Math.random() < sparksChance) {"
)
new_spark_emission = (
    "          // If moving actively, eject sparkles at the tip (scale quantity with quickness)\n"
    "          // PERF: Skip in camera mode - saves particle alloc/render per frame\n"
    "          const sparksChance = Math.min(0.85, 0.35 + tipDist * 0.015);\n"
    "          if (!effectivePerformanceMode && tipDist > 6 && Math.random() < sparksChance) {"
)
if old_spark_emission in code:
    code = code.replace(old_spark_emission, new_spark_emission, 1)
    patches_applied.append('[P2] Trail tip spark emission disabled in camera mode')

# ----- PATCH 3: Simplify hand halo in camera mode - no pulsation, single dot -----
old_halo_start = (
    "            // Pulsate outer tracking ring\n"
    "            const timePulse = Date.now();\n"
    "            const ringRadius = 15 + Math.sin(timePulse * 0.015) * 2.8;\n"
    "            \n"
    "            // Outer glowing dashed ring (Emerald for Hand 0, Pink for Hand 1)\n"
    "            ctx.strokeStyle = !isHand1 ? '#10b981' : '#ec4899';\n"
    "            ctx.lineWidth = 1.8;\n"
    "            ctx.setLineDash([4, 4]);\n"
    "            ctx.beginPath();\n"
    "            ctx.arc(cursorX, cursorY, ringRadius, 0, Math.PI * 2);\n"
    "            ctx.stroke();\n"
    "            \n"
    "            // Inner hot core\n"
    "            ctx.setLineDash([]);\n"
    "            ctx.fillStyle = '#ffffff';\n"
    "            ctx.beginPath();\n"
    "            ctx.arc(cursorX, cursorY, 4, 0, Math.PI * 2);\n"
    "            ctx.fill();\n"
    "            \n"
    "            ctx.strokeStyle = !isHand1 ? '#22d3ee' : '#f472b6'; // cyan or light pink glow border\n"
    "            ctx.lineWidth = 1.25;\n"
    "            ctx.beginPath();\n"
    "            ctx.arc(cursorX, cursorY, 4, 0, Math.PI * 2);\n"
    "            ctx.stroke();"
)
new_halo = (
    "            // PERF: Simplified halo cursor - single dot, no pulsation math\n"
    "            const dotColor = !isHand1 ? '#10b981' : '#ec4899';\n"
    "            ctx.fillStyle = '#ffffff';\n"
    "            ctx.beginPath();\n"
    "            ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);\n"
    "            ctx.fill();\n"
    "            ctx.strokeStyle = dotColor;\n"
    "            ctx.lineWidth = 2;\n"
    "            ctx.stroke();"
)
if old_halo_start in code:
    code = code.replace(old_halo_start, new_halo, 1)
    patches_applied.append('[P3] Hand halo: pulsating ring (3 arc ops) -> simple dot (1 arc op), removes sin() per frame')

# ----- PATCH 4: Gate pizza ambient glow on effectivePerformanceMode -----
old_pizza_glow = (
    "        // Circular ambient backing glow\n"
    "        if (!performanceMode) {"
)
new_pizza_glow = (
    "        // Circular ambient backing glow (skip in camera/perf mode - expensive per-pizza gradient)\n"
    "        if (!effectivePerformanceMode) {"
)
if old_pizza_glow in code:
    code = code.replace(old_pizza_glow, new_pizza_glow, 1)
    patches_applied.append('[P4] Pizza ambient glow: !performanceMode -> !effectivePerformanceMode (skipped in camera mode)')

# ----- PATCH 5: Cap trail to 8 points in camera mode (was 18) -----
old_trail_max = (
    "              // PERF: Cap trail at 18 points max -- longer trails waste GPU\n"
    "              const MAX_TRAIL = 18;"
)
new_trail_max = (
    "              // PERF: Cap trail at 8 points in camera mode (smaller = fewer stroke ops per pass)\n"
    "              const MAX_TRAIL = effectivePerformanceMode ? 8 : 18;"
)
if old_trail_max in code:
    code = code.replace(old_trail_max, new_trail_max, 1)
    patches_applied.append('[P5] Trail max: 18 -> 8 points in camera mode (fewer stroke calls per pass)')

# ----- PATCH 6: Reduce max particles to 8 in camera mode -----
old_max_particles = (
    "      const maxParticles = effectivePerformanceMode\n"
    "        ? (isMobile ? 8 : 18)\n"
    "        : (isMobile ? 32 : 95);"
)
new_max_particles = (
    "      const maxParticles = effectivePerformanceMode\n"
    "        ? (isMobile ? 4 : 8)   // camera mode: minimal particles\n"
    "        : (isMobile ? 32 : 95);"
)
if old_max_particles in code:
    code = code.replace(old_max_particles, new_max_particles, 1)
    patches_applied.append('[P6] Max particles in camera: 18 -> 8 (4 on mobile)')

if code == original:
    print('WARNING: Some patches may not have found their patterns.')
    # Debug: check which old patterns are missing
    checks = [
        ('PASS 1 trail wrap', '          // PASS 1: Wide background aura\n'),
        ('spark emission guard', 'const sparksChance = Math.min(0.85'),
        ('halo pulsation', 'const timePulse = Date.now();'),
        ('pizza glow guard', '        if (!performanceMode) {'),
        ('trail max 18', 'const MAX_TRAIL = 18;'),
    ]
    for name, pattern in checks:
        found = pattern in code
        print(f'  {name}: {"FOUND" if found else "NOT FOUND"}')
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f'SUCCESS: Applied {len(patches_applied)} patches to PizzaCanvas.tsx:')
    for p in patches_applied:
        print(f'  {p}')
