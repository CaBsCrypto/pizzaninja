# Handoff Report — Explorer 1 (Requirement R1 Survey)

**Target**: Requirement R1 — Responsive Canvas & Mobile Viewport Scaling
**Working Directory**: `C:\Users\MGC\Documents\antigravity\blissful-hawking\.agents\explorer_survey_r1`
**Date**: 2026-08-18T20:34:00Z
**Handoff Type**: Hard (Investigation Complete)

---

## 1. Observation

Direct observations from inspecting the codebase:

1. **`index.html` (lines 4–6)**:
   ```html
   <meta charset="UTF-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   ```
   Lacks `viewport-fit=cover` and user scaling constraint flags.

2. **`src/App.tsx` (lines 613–628 & 678–680)**:
   ```tsx
   613: <header className="relative w-full max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-40 shrink-0">
   ...
   678: <main className="relative w-full max-w-[96%] xl:max-w-7xl mx-auto px-2 sm:px-4 py-2 z-40 flex-1 min-h-0 flex flex-col items-center justify-center">
   679: 
   680:   <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
   ```
   - Line 613: Header is `flex-col` on all viewports under 768px width (including mobile landscape), occupying 130–150px vertical height.
   - Line 680: The intermediate flex child has `flex-1 min-h-0 flex flex-col items-center justify-center` but **lacks `w-full` or `self-stretch`**, causing Flexbox shrink-wrap to compute child width from content.

3. **`src/App.tsx` (lines 785–829)**:
   ```tsx
   785: <div className="fixed inset-0 z-50 bg-blue-900 flex flex-col items-center justify-center text-center p-6 pointer-events-auto select-none md:hidden portrait:flex landscape:hidden">
   ...
   813:   <h2 className="...">🥷 Gira tu Pantalla</h2>
   ```
   Renders a full-screen blocking overlay on any mobile screen in portrait orientation (`portrait:flex`), blocking menu interactions and gameplay completely.

4. **`src/App.tsx` (lines 321–340 & 733–745)**:
   ```tsx
   321: const scoreRegistrationCard = pendingScore && (
   322:   <div className="panel-clash p-6 md:p-8 rounded-3xl w-full max-w-2xl md:max-w-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-6 items-center mx-auto z-50 pointer-events-auto">
   ```
   The modal card has fixed padding (`p-6 md:p-8`), height ~390px, and `overflow-hidden` with no `max-h` or scrolling container. On mobile viewports with height <= 375px, the form input and submit buttons are sliced off at the bottom.

5. **`src/App.tsx` (lines 832–845)**:
   ```tsx
   832: <button
   833:   onClick={() => setIsWalletOpen(true)}
   834:   className="fixed right-0 top-1/3 -translate-y-1/2 z-40 py-4 px-2 rounded-l-2xl border-y-4 border-l-4 ..."
   ```
   Fixed floating tab sits on the right edge of mobile screens, intercepting touch swipes during gameplay.

6. **`src/components/PizzaCanvas.tsx` (lines 2854–2862)**:
   ```tsx
   2854: return (
   2855:   <div className="w-full h-full flex-1 min-h-0 relative flex items-center justify-center">
   2856:     <div
   2857:       ref={containerRef}
   2858:       style={{ clipPath: 'inset(0 round 1.5rem)' }}
   2859:       className={`relative w-auto max-w-full h-full max-h-[82vh] aspect-[16/9] mx-auto bg-slate-950/95 shadow-2xl flex flex-col border-[4px] transition-colors duration-150 overflow-hidden ${
   ```
   - `w-auto` + `aspect-[16/9]` + `max-h-[82vh]`: In portrait mobile (375x667), 16:9 forces container height to 210px (375 * 9 / 16). In landscape mobile (667x375), 140px header reduces remaining height to 220px, so 16:9 gives a 320x180px box.

7. **`src/components/PizzaCanvas.tsx` (lines 3094–3200)**:
   - Top Nav Bar (line 3097): ~56px height.
   - Mascot image (line 3153): `w-48 h-48` (192px).
   - Title/subtitle (line 3160): ~60px.
   - Play buttons (lines 3174–3198): `py-4 px-6` with `gap-3` (~130px).
   - Total content height = 438px.
   - Inside the 210px collapsed container with `overflow-hidden`, content overflows and the Start buttons are pushed off-screen.

8. **`src/components/PizzaCanvas.tsx` (lines 2870–3066)**:
   HUD elements (Score, Lives, Combo, Level, Audio, Fullscreen, Oven Timer) sum to >520px width, causing horizontal wrapping and pizza occlusion on mobile screens (<500px).

9. **`src/components/PizzaCanvas.tsx` (lines 2689–2691)**:
   ```tsx
   const handlePointerLeave = () => {
     stateRef.current.isMousePressed = false;
   };
   ```
   Cancels slice strokes as soon as a finger crosses the edge of the canvas.

---

## 2. Logic Chain

1. From **Observation 2**, `<div className="flex-1 min-h-0 flex flex-col items-center justify-center">` (line 680) does not declare `w-full` inside an `items-center` parent `<main>`.
2. Therefore, CSS Flexbox applies shrink-to-fit sizing to line 680 based on its child's intrinsic width.
3. From **Observation 6**, `PizzaCanvas` specifies `w-auto aspect-[16/9]`.
4. The combination of shrink-to-fit parent width and child `w-auto aspect-[16/9]` creates a circular constraint that collapses the container horizontally and vertically on small viewports and in iframes.
5. In portrait mobile viewports (e.g. 375x667), width is 375px; rigid 16:9 limits height to 210px.
6. From **Observation 7**, Main Menu content requires 438px vertical height.
7. Because the container height is 210px and has `overflow-hidden`, the bottom 228px (which contains "JUGAR NORMAL" and "JUGAR CÁMARA") is clipped out.
8. Therefore, users on mobile screens see a collapsed canvas and missing/unclickable start buttons.
9. From **Observation 3**, the portrait warning overlay completely blocks portrait interaction, compounding the issue.
10. From **Observation 4**, `scoreRegistrationCard` lacks `max-h` and scrolling, making the score submission form unclickable on mobile landscape (height <= 375px).
11. From **Observation 8**, the in-game HUD lacks compact mobile styling, causing overflow on screens < 520px.

---

## 3. Caveats

- Hand tracking (webcam/MediaPipe in camera mode) requires camera permissions and sufficient CPU power; on low-end mobile devices, mouse/touch mode is the primary control method.
- Safe area insets (`env(safe-area-inset-top)`, etc.) depend on `viewport-fit=cover` in `index.html`.
- No caveats regarding requirement discovery or code location accuracy.

---

## 4. Conclusion

The mobile collapse and UI clipping issues in Requirement R1 are caused by a combination of:
1. Missing `w-full` on `App.tsx:680` triggering Flexbox shrink-wrap collapse.
2. Rigid `aspect-[16/9]` and `max-h-[82vh]` on `PizzaCanvas.tsx:2859` collapsing container height to 210px on portrait and width to 320px on landscape.
3. Fixed large menu dimensions (438px) overflowing the 210px container with `overflow-hidden`.
4. Header layout stacking (140px) on mobile landscape.
5. Hard portrait mode blocker overlay in `App.tsx:785`.
6. Score registration modal in `App.tsx:321` missing `max-h` scroll container.
7. HUD in `PizzaCanvas.tsx:2870` exceeding 520px width on small screens.

Implementing the 6 architectural fixes documented in `survey_r1.md` will completely resolve R1 across all target viewports (375x667, 390x844, 412x915 portrait/landscape and iframe embedding).

---

## 5. Verification Method

To independently verify the findings and subsequent fixes:
1. **Compilation Check**:
   ```bash
   npm run build
   npm run lint
   ```
2. **Viewport Simulation Matrix**:
   - iPhone SE Portrait (375x667): Verify canvas container occupies available viewport, mascot and Start buttons are centered and visible, and registration modal is operable.
   - iPhone SE Landscape (667x375): Verify header is minimized/hidden during play, canvas expands to fill viewport, and HUD fits without wrapping.
   - iPhone 12/13/14 (390x844 & 844x390): Verify full scaling in portrait and landscape.
   - Pixel 7 / Android (412x915 & 915x412): Verify layout adaptability.
   - Iframe test: Render inside `<iframe src="..." style="width:100%;height:100%">` at various dimensions to confirm zero collapse.
3. **Touch Targets Inspection**:
   Inspect bounding client rects of all interactive buttons to confirm >= 44x44px.
