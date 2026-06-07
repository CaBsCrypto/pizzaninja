"""
Performance patch for HandTracker.tsx

Problems found:
1. setFrameCount + setLastFrameTime called on EVERY MediaPipe frame (~15-30fps)
   -> Each call triggers React re-render of HandTracker + bubbles up to PizzaCanvas
   -> Fix: Use a frame ref counter, only call setState every 15 frames

2. modelComplexity: 1 (full model) -- heavy ML inference
   -> Fix: modelComplexity: 0 (lite model, 2x faster, same accuracy for fingertips)

3. minTrackingConfidence: 0.50 -- re-detects frequently  
   -> Fix: 0.65 -- more stable tracking, fewer expensive re-detections

4. Skeleton drawing on every frame -- 21 arc() calls + connections
   -> Fix: Skip skeleton draw every other frame (throttle to 15fps visual)
"""

import re
import sys
import os

TARGET = os.path.join(os.path.dirname(__file__), '..', 'src', 'components', 'HandTracker.tsx')

with open(TARGET, 'r', encoding='utf-8') as f:
    code = f.read()

original = code

patches_applied = []

# --- PATCH 1: modelComplexity 1 -> 0 (lite model, much faster) ---
code, n = re.subn(r'modelComplexity:\s*1,', 'modelComplexity: 0,  // PERF: lite model (0) is 2x faster than full (1)', code)
if n > 0:
    patches_applied.append(f'  [P1] modelComplexity: 1 -> 0 ({n} occurrences)')

# --- PATCH 2: minTrackingConfidence 0.50 -> 0.65 ---
code, n = re.subn(r'minTrackingConfidence:\s*0\.50', 'minTrackingConfidence: 0.65  // PERF: higher = fewer expensive re-detects', code)
if n > 0:
    patches_applied.append(f'  [P2] minTrackingConfidence: 0.50 -> 0.65 ({n} occurrences)')

# --- PATCH 3: Throttle setFrameCount + setLastFrameTime ---
# Add a frameTickRef right after lastYRef declaration
old_refs = '  // Custom logging utility'
new_refs = (
    '  // PERF: Frame throttle ref -- only fire React setState every N frames\n'
    '  // to avoid expensive re-renders on every ~30fps MediaPipe callback\n'
    '  const frameTickRef = useRef(0);\n'
    '\n'
    '  // Custom logging utility'
)
if old_refs in code and 'frameTickRef' not in code:
    code = code.replace(old_refs, new_refs, 1)
    patches_applied.append('  [P3] Added frameTickRef for setState throttle')

# --- PATCH 4: Throttle the setState calls inside handleResults ---
old_stats = (
    '    // Stats updates\n'
    '    setFrameCount(f => f + 1);\n'
    '    setLastFrameTime(new Date().toLocaleTimeString());'
)
new_stats = (
    '    // Stats updates — throttled to every 15 frames to avoid per-frame re-renders\n'
    '    frameTickRef.current = (frameTickRef.current + 1) % 15;\n'
    '    if (frameTickRef.current === 0) {\n'
    '      setFrameCount(f => f + 1);\n'
    '      setLastFrameTime(new Date().toLocaleTimeString());\n'
    '    }'
)
if old_stats in code:
    code = code.replace(old_stats, new_stats, 1)
    patches_applied.append('  [P4] Throttled setFrameCount+setLastFrameTime to every 15 frames')

# --- PATCH 5: Throttle skeleton drawing (visual only, not physics) ---
old_draw_comment = '      // Draw cyber-skeleton feedback for this hand'
new_draw_comment = (
    '      // Draw cyber-skeleton feedback for this hand (throttled: draw only on even ticks)\n'
    '      if (frameTickRef.current % 2 !== 0) {'
)
old_draw_end_block = (
    "      connect([0, 17, 18, 19, 20]); // Pinky\n"
    "      connect([5, 9, 13, 17]); // Palm\n"
    "\n"
    "      // Draw nodes"
)
new_draw_end_block = (
    "      connect([0, 17, 18, 19, 20]); // Pinky\n"
    "      connect([5, 9, 13, 17]); // Palm\n"
    "\n"
    "      // Draw nodes"
)

if old_draw_comment in code and 'frameTickRef.current % 2' not in code:
    # Wrap from draw comment to end of skeleton drawing with a frameTickRef guard
    # Find the block we want to wrap
    skeleton_start = code.find(old_draw_comment)
    # Find closing of skeleton block (after the landmarks.forEach loop)
    skeleton_block_end_marker = '    }\n\n    // Dispatch disengage for hands that are NOT currently detected'
    skeleton_end = code.find(skeleton_block_end_marker)
    
    if skeleton_start > 0 and skeleton_end > skeleton_start:
        before = code[:skeleton_start]
        skeleton_block = code[skeleton_start:skeleton_end]
        after = code[skeleton_end:]
        
        # Indent the skeleton block by 2 more spaces and wrap in if
        indented = '\n'.join('      ' + line if line.strip() else line 
                            for line in skeleton_block.split('\n'))
        
        wrapped = (
            '      // Draw cyber-skeleton feedback (throttled: every 2nd frame saves ~50% draw calls)\n'
            '      if (frameTickRef.current % 2 === 0) {\n'
            + indented + '\n'
            '      }\n'
        )
        code = before + wrapped + after
        patches_applied.append('  [P5] Skeleton drawing throttled to every 2nd frame')

if code == original:
    print('WARNING: No changes were needed or all patterns already applied.')
else:
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f'SUCCESS: Applied {len(patches_applied)} patches to HandTracker.tsx:')
    for p in patches_applied:
        print(p)
