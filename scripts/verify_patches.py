import re

# === VERIFY HandTracker.tsx ===
with open('src/components/HandTracker.tsx', 'r', encoding='utf-8') as f:
    ht = f.read()

checks = [
    ('scaleCanvasRef useRef declared', 'const scaleCanvasRef = useRef<HTMLCanvasElement | null>(null)'),
    ('Video scaled to 320x240', 'sCtx.drawImage(videoRef.current, 0, 0, 320, 240)'),
    ('Sends scaleCanvas not video', 'send({ image: scaleCanvasRef.current })'),
    ('setTimeout tick loop (inside)', 'frameIdRef.current = setTimeout(tick, 0)'),
    ('clearTimeout cleanup', 'clearTimeout(frameIdRef.current)'),
    ('Skeleton simplified to dot', 'PERF: Draw only index finger tip dot'),
    ('frameTickRef throttle', 'frameTickRef.current = (frameTickRef.current + 1) % 15'),
    ('modelComplexity 0', 'modelComplexity: 0,'),
    ('minTrackingConfidence 0.65', 'minTrackingConfidence: 0.65'),
    ('20fps throttle', 'TARGET_FPS = 20'),
    ('No raw requestAnimationFrame send', 'requestAnimationFrame(tick)'),  # should NOT be found
]

print('=== HandTracker.tsx verification ===')
for name, pattern in checks:
    found = pattern in ht
    if name == 'No raw requestAnimationFrame send':
        status = 'FAIL' if found else 'OK'
        print(f'  [{status}] requestAnimationFrame(tick) REMOVED: {not found}')
    else:
        status = 'OK' if found else 'FAIL'
        print(f'  [{status}] {name}')

res_match = re.search(r'width.*?ideal.*?(\d+).*?height.*?ideal.*?(\d+)', ht, re.DOTALL)
if res_match:
    print(f'  [INFO] Camera resolution requested: {res_match.group(1)}x{res_match.group(2)}')

# === VERIFY PizzaCanvas.tsx ===
with open('src/components/PizzaCanvas.tsx', 'r', encoding='utf-8') as f:
    pc = f.read()

checks2 = [
    ('effectivePerformanceMode declared at top of loop', 'const effectivePerformanceMode = performanceMode || controlMode ==='),
    ('Trail cap 8 pts in camera', 'MAX_TRAIL = effectivePerformanceMode ? 8 : 18'),
    ('PASS 1+2 skipped in camera', 'PASS 1 + 2: Wide aura + hot trail (skipped in camera'),
    ('Spark particles disabled camera', 'if (!effectivePerformanceMode && tipDist > 6'),
    ('Halo cursor simplified', 'PERF: Simplified halo cursor'),
    ('Pizza glow effectivePerf guard', 'Circular ambient backing glow (skip in camera'),
    ('Checkerboard skipped camera', 'PERF: Skip in camera mode -- saves'),
    ('Max particles 8 camera', '(isMobile ? 4 : 8)'),
    ('startGame preserves camera state', 'Preserve live camera hand tracking'),
    ('Auto-pause 3s guard', 'gameRunningFor > 3000'),
    ('onCoordsTrackedRef stale fix', 'onCoordsTrackedRef.current = onCoordsTracked'),
]

print()
print('=== PizzaCanvas.tsx verification ===')
for name, pattern in checks2:
    found = pattern in pc
    status = 'OK' if found else 'FAIL'
    print(f'  [{status}] {name}')

all_rg = pc.count('createRadialGradient')
print(f'  [INFO] Total createRadialGradient calls: {all_rg}')
print(f'  [INFO] effectivePerformanceMode guards: {pc.count("if (!effectivePerformanceMode)")}')
