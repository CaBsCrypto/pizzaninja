## 2026-08-18T20:35:31Z
You are Worker 1 for Milestone 1 (Responsive Canvas & Mobile Viewport Scaling - Requirement R1).
Your working directory is: C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\worker_m1_1

You must read:
- ORIGINAL_REQUEST.md at C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\ORIGINAL_REQUEST.md (under the latest follow-up header)
- PROJECT.md at C:\Users\MGC\Documents\antigravity\blissful-hawking\PROJECT.md
- Survey R1 report at C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_r1\survey_r1.md

Exclusive Write Ownership:
- `index.html`
- `src/index.css`
- `src/App.tsx` (layout, header, main wrapper, portrait warning removal, wallet tab)
- `src/components/PizzaCanvas.tsx` (responsive canvas container, start buttons sizing, responsive HUD, pointer leave fix)

Your task:
Implement all required changes for Milestone 1 / Requirement R1:
1. `index.html`: Update viewport meta tag to `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`.
2. `src/index.css`: Ensure root html/body/root resets (`width: 100%; height: 100%; overflow: hidden; touch-action: none; -webkit-touch-callout: none; user-select: none;`) and safe-area utilities.
3. `src/App.tsx`:
   - Header responsiveness: Make header compact on mobile (`px-2 py-2 sm:px-4 sm:py-3`), and minimize/hide header when `isPlaying === true` on mobile so canvas gets maximum viewport.
   - Main wrapper: Add `w-full` to `<div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center relative">` to eliminate Flexbox shrink-wrap collapse.
   - Remove or make dismissible the hard-blocking portrait mode overlay (`portrait:flex`) so portrait mobile gameplay is fully supported.
   - Floating side wallet tab: Hide or reposition on small mobile screens during active gameplay so it doesn't intercept touch slices.
   - Score registration modal: Ensure `max-h-[90vh]` and `overflow-y-auto` so it never overflows on small mobile screens.
4. `src/components/PizzaCanvas.tsx`:
   - Canvas container: Replace rigid `aspect-[16/9]` + `max-h-[82vh]` with flexible responsive container that adapts to both portrait (e.g. 375x667, 390x844, 412x915) and landscape viewports, as well as iframes.
   - Main menu: Adapt mascot, title, and Start/Play buttons ("JUGAR NORMAL" / "JUGAR CÁMARA") to scale responsively so they are 100% visible, centered, and touch-clickable without clipping by `overflow-hidden`.
   - In-Game HUD: Style HUD cards with compact responsive classes on small screens (<520px) to prevent wrapping, overlap, or pizza occlusion.
   - Pointer leave: Prevent `handlePointerLeave` from abruptly cancelling touch strokes when finger touches momentarily cross canvas boundary.
5. Verify your changes:
   - Run `npm run lint` (`npx tsc --noEmit`)
   - Run `npm run build`
   - Document commands and test outcomes in your handoff report.
