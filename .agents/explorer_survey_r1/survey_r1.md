# Requirement R1 Comprehensive Codebase Survey Report
**Project**: Slash Slice Arena
**Target**: Requirement R1 — Responsive Canvas & Mobile Viewport Scaling
**Surveyor**: Explorer 1
**Date**: 2026-08-18

---

## 1. Executive Summary

Requirement R1 addresses the mobile responsiveness and container sizing of *Slash Slice Arena*, specifically:
1. Preventing the game canvas and container from collapsing or appearing severely shrunk in the center on mobile smartphones (portrait and landscape orientations: e.g., 375x667, 390x844, 412x915) and when embedded in `iframe` containers.
2. Ensuring all UI components (Start/Play buttons, Top Navigation, Knife selection Armería, Settings, Tutorial, Game Over/Score Registration modal, Shop, and Stellar Hub drawer) are fully visible, properly centered, accessible, and easily clickable with finger touch targets (>= 44x44px) without overflowing or clipping.

Our audit has uncovered **8 specific root causes** spanning `index.html`, `src/App.tsx`, `src/components/PizzaCanvas.tsx`, `src/index.css`, `src/components/Shop.tsx`, and `src/components/StellarHub.tsx`.

---

## 2. Inventory of Involved Source Files

| File Path | Role in Requirement R1 | Key Issues Identified |
|---|---|---|
| `index.html` | HTML Shell, viewport meta tag, font & asset loaders | Missing `viewport-fit=cover`, missing touch resets for root container, default 1.0 scale without touch constraints |
| `src/index.css` | Global CSS utilities, fullscreen CSS, animation styles | Missing safe-area padding variables, missing mobile touch-action prevention rules |
| `src/App.tsx` | Root application layout, main header, layout wrappers, score modal, drawer | Header stacking consumes >140px on mobile; main wrapper missing `w-full`/`h-full` causing Flexbox shrink-wrap collapse; Portrait Blocker overlay completely disables vertical mobile gameplay; score registration modal has no `max-h` scroll container |
| `src/components/PizzaCanvas.tsx` | Game canvas, container ref, resize observer, menu overlay, in-game HUD, modals | Rigid `aspect-[16/9]` + `max-h-[82vh]` forces canvas to shrink to 210px in portrait and 190px in landscape; Main Menu content exceeds 440px height inside a 210px container, causing Start buttons to be clipped by `overflow-hidden`; In-game HUD overflows screen width (<520px); `handlePointerLeave` cancels swipes prematurely |
| `src/components/Shop.tsx` | Web3 cosmetic items shop modal | Backdrop container sizing in mobile landscape, modal overflow scroll handling |
| `src/components/StellarHub.tsx` | Stellar wallet connect & profile registration modal/drawer | Drawer width on 375px viewports, form layout and avatar grid on small screens |
| `src/components/HandTracker.tsx` | Optical hand detection webcam overlay | Scaling of webcam feedback box on mobile landscape/portrait |

---

## 3. Deep Root-Cause Analysis of the Mobile Shrinking & Collapse Bug

### 3.1. Root Cause 1: Flexbox Shrink-Wrap Cascade in `App.tsx`
- **Location**: `src/App.tsx`, lines 678–680
```tsx
678: <main className="relative w-full max-w-[96%] xl:max-w-7xl mx-auto px-2 sm:px-4 py-2 z-40 flex-1 min-h-0 flex flex-col items-center justify-center">
679: 
680:   <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
```
- **Mechanism**:
  `<main>` is a flex container with `items-center`.
  Line 680 is an intermediate child `<div className="flex-1 min-h-0 flex flex-col items-center justify-center">` that **lacks `w-full` or `self-stretch`**.
  In CSS Flexbox, when `items-center` is set on the parent and the child lacks explicit `width: 100%`, the child's width shrinks to fit its children (`shrink-wrap`).
  Because `PizzaCanvas`'s container has `w-auto`, the width computation creates a circular dependency and collapses to the minimum content width or 0.

### 3.2. Root Cause 2: Rigid `aspect-[16/9]` with `max-h-[82vh]` and `w-auto` in `PizzaCanvas.tsx`
- **Location**: `src/components/PizzaCanvas.tsx`, lines 2854–2862
```tsx
2854: return (
2855:   <div className="w-full h-full flex-1 min-h-0 relative flex items-center justify-center">
2856:     <div
2857:       ref={containerRef}
2858:       style={{ clipPath: 'inset(0 round 1.5rem)' }}
2859:       className={`relative w-auto max-w-full h-full max-h-[82vh] aspect-[16/9] mx-auto bg-slate-950/95 shadow-2xl flex flex-col border-[4px] transition-colors duration-150 overflow-hidden ${
2860:         damageFlash ? 'border-red-600 bg-red-950/80 shadow-[0_0_50px_rgba(220,38,38,0.8)]' : 'border-amber-500'
2861:       }`}
2862:     >
```
- **Mechanism**:
  - **Portrait Viewports (e.g. 375x667, 390x844, 412x915)**:
    Available width is 375px. With `aspect-[16/9]`, container height = `375 * 9 / 16 = 210.9px`.
    The game container renders as a tiny 210px horizontal strip centered on a 667px or 844px tall screen. 70% of the screen remains unused black space.
  - **Landscape Viewports (e.g. 667x375, 844x390)**:
    Viewport height is 375px. The stacked `App.tsx` header consumes ~140px. The remaining vertical space for `<main>` is only ~220px.
    `max-h-[82vh]` on 220px gives ~180px height.
    With `aspect-[16/9]`, width = `180 * 16 / 9 = 320px`.
    On a 667px or 844px wide screen, the game collapses into a tiny 320x180 box in the center of the phone!
  - **Iframe embedding**:
    When embedded in an iframe with dynamic or non-16:9 aspect ratios, `w-auto aspect-[16/9]` causes unpredictable height/width collapse.

### 3.3. Root Cause 3: Main Menu Height Overflow & Start Buttons Disappearing
- **Location**: `src/components/PizzaCanvas.tsx`, lines 3094–3200
- **Mechanism**:
  Inside the 210px (portrait) or 180px (landscape) collapsed container:
  - Top Nav Bar (line 3097) occupies ~56px.
  - Mascot image (line 3153) is `w-48 h-48` (192px tall).
  - Title and subtitle (line 3160) occupy ~60px.
  - Play Buttons ("JUGAR NORMAL" and "JUGAR CÁMARA", lines 3174–3198) are `py-4 px-6` with `text-xl md:text-2xl` and `gap-3` (occupying ~130px).
  - Total vertical content height = **438px**.
  Because the container has `overflow-hidden` (line 2859), any content beyond 210px is clipped. The Start buttons are pushed completely off-screen and become 100% invisible and impossible to click!

### 3.4. Root Cause 4: Header Stacking & Permanent Screen Occlusion
- **Location**: `src/App.tsx`, lines 613–675
```tsx
613: <header className="relative w-full max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-40 shrink-0">
```
- **Mechanism**:
  - `flex-col md:flex-row`: Any screen `< 768px` wide (including mobile landscape!) stacks the header items vertically.
  - On mobile, the header takes ~140px height.
  - The header is rendered unconditionally even while `isPlaying === true`, leaving almost zero playable canvas space on mobile.

### 3.5. Root Cause 5: Portrait Mode Blocker Overlay
- **Location**: `src/App.tsx`, lines 785–829
```tsx
785: <div className="fixed inset-0 z-50 bg-blue-900 flex flex-col items-center justify-center text-center p-6 pointer-events-auto select-none md:hidden portrait:flex landscape:hidden">
786:   ...
813:   <h2 className="...">🥷 Gira tu Pantalla</h2>
814:   <span className="...">MODO CONSOLA HORIZONTAL 16:9</span>
```
- **Mechanism**:
  This overlay completely blocks the user in portrait mode on any mobile screen (`portrait:flex`), preventing portrait gameplay and violating Requirement R1's mandate to support mobile viewports in both vertical and horizontal orientations.

### 3.6. Root Cause 6: In-Game HUD Width Collision on Mobile (<520px)
- **Location**: `src/components/PizzaCanvas.tsx`, lines 2870–3066
- **Mechanism**:
  The in-game HUD contains 6 large cards with `border-4` and `px-4`/`px-5` paddings:
  - Score box (~120px) + Combo bubble (~60px)
  - Lives box (~100px)
  - Level badge (~80px)
  - Audio popover button (~44px)
  - Fullscreen button (~40px)
  - Oven countdown (~110px)
  Total combined width exceeds 520px. On mobile portrait (375px–412px), items wrap, overlap, cover pizzas, or push out of the viewport.

### 3.7. Root Cause 7: Game Over / Score Registration Modal Missing Max-Height Scroll
- **Location**: `src/App.tsx`, lines 321–602 & 733–745
- **Mechanism**:
  `scoreRegistrationCard` is rendered in `absolute inset-0 z-[100]`.
  The card has `overflow-hidden` and fixed padding (`p-6 md:p-8`), with content height ~390px.
  On screens with height <= 375px (mobile landscape or small smartphones), the input field and "GUARDAR RÉCORD" / "Omitir" buttons overflow off the bottom edge without scrolling capability, trapping the user.

### 3.8. Root Cause 8: Touch Slicing Abort on Edge Leave
- **Location**: `src/components/PizzaCanvas.tsx`, lines 2689–2691 & 3075–3079
```tsx
2689: const handlePointerLeave = () => {
2690:   stateRef.current.isMousePressed = false;
2691: };
```
- **Mechanism**:
  On small screens, finger swipes frequently cross the boundary of the canvas by a few pixels. `handlePointerLeave` immediately sets `isMousePressed = false`, cancelling the slice stroke in mid-air.

---

## 4. UI Modals & Touch Targets Audit

| UI Component | File & Lines | Current Sizing / Layout | Mobile Small Screen Issues | Recommended Fix |
|---|---|---|---|---|
| **Main Menu Start Buttons** | `PizzaCanvas.tsx:3174-3198` | `py-4 px-6`, `text-xl md:text-2xl`, fixed margin `mt-6` | Clipped by `overflow-hidden` in collapsed container | Responsive padding (`py-2.5 sm:py-3.5`), font scale `text-sm sm:text-lg`, container adaptive height |
| **Top Navigation Icons** | `PizzaCanvas.tsx:3097-3143` | `w-12 h-12 md:w-16 md:h-16`, `top-4 inset-x-4` | Takes too much vertical space; overlaps mascot on small screens | `w-10 h-10 sm:w-12 sm:h-12`, `top-2 inset-x-2`, compact gap |
| **Mascot Artwork** | `PizzaCanvas.tsx:3153` | `w-48 h-48 md:w-64 md:h-64` | Dominates screen height (192px out of 210px) | `w-20 h-20 sm:w-32 sm:h-32 md:w-48 md:h-48 landscape:w-24 landscape:h-24` |
| **Armería (Knives Modal)** | `PizzaCanvas.tsx:3242-3268` | 2-col grid, `p-4` buttons, `text-4xl` | Exceeds screen height on landscape | `p-2 sm:p-3`, `text-2xl sm:text-3xl`, `max-h-[80vh] overflow-y-auto` |
| **Tutorial Modal** | `PizzaCanvas.tsx:3270-3294` | 3 cards with `p-4`, `text-2xl` emoji | Overflows on landscape mobile | `p-2.5 sm:p-3`, `text-xs`, `max-h-[80vh] overflow-y-auto` |
| **Settings Modal** | `PizzaCanvas.tsx:3297-3351` | 3 vertical sections | Overflows on landscape mobile | `max-h-[80vh] overflow-y-auto`, compact buttons `p-1.5` |
| **Score Registration Modal** | `App.tsx:321-602` | `p-6 md:p-8`, flex-col md:flex-row, `overflow-hidden` | Form input and submit buttons clipped on height <= 375px | `max-h-[90vh] overflow-y-auto`, `p-4 sm:p-6`, compact input `py-2 sm:py-3 text-lg` |
| **Mercado Web3 (Shop)** | `Shop.tsx:30-108` | `p-6`, `max-h-[80vh]` | Good, but needs `p-3 sm:p-6` and compact list items on mobile | Reduce padding to `p-3 sm:p-5`, item gap to `gap-2` |
| **Stellar Hub Drawer** | `App.tsx:866`, `StellarHub.tsx` | `w-[310px] sm:w-[350px]`, `p-5` | On 375px screen, fills almost full screen; header button touch targets | `w-full max-w-[340px]`, `p-3 sm:p-4`, avatar grid `grid-cols-4 gap-1.5` |
| **Floating Side Wallet Tab** | `App.tsx:832-845` | `fixed right-0 top-1/3 z-40` | Blocks slicing gameplay on right edge of mobile screens | Hide on mobile (`hidden md:flex`) or integrate into top header |

---

## 5. Viewport Sizing Matrix Across Target Mobile Resolutions

| Target Viewport | Orientation | Available Width x Height | Container Behavior (Current vs Proposed) | UI Visibility / Usability |
|---|---|---|---|---|
| **iPhone SE (375x667)** | Portrait | 375 x 667 | **Current**: Shrunk to 375x210 (or blocked by rotation warning). Start buttons clipped.<br>**Proposed**: Adaptive container filling 96% width and height (~360x540), Start buttons & mascot cleanly stacked. | 100% accessible, centered, touch-friendly |
| **iPhone SE (667x375)** | Landscape | 667 x 375 | **Current**: Shrunk to 320x180 due to stacked header taking 140px.<br>**Proposed**: Compact header (hidden or inline 40px), game container expands to 640x320. | 100% visible, wide slicing canvas |
| **iPhone 12/13/14 (390x844)** | Portrait | 390 x 844 | **Current**: Shrunk to 390x219 with 600px of empty black background.<br>**Proposed**: Adaptive filling 380x680, full vertical layout with comfortable menu spacing. | 100% accessible |
| **iPhone 12/13/14 (844x390)** | Landscape | 844 x 390 | **Current**: Shrunk to ~340x190 box.<br>**Proposed**: Container fills ~800x370 with 16:9 or letterboxed fit. | Full console experience |
| **Pixel 7 / S20 (412x915)** | Portrait | 412 x 915 | **Current**: Shrunk to 412x231.<br>**Proposed**: Adaptive filling 400x720. | Full console experience |
| **Pixel 7 / S20 (915x412)** | Landscape | 915 x 412 | **Current**: Shrunk to ~360x200 box.<br>**Proposed**: Container fills ~870x390. | Full console experience |
| **Iframe Embedding (e.g. 400x600, 800x600)** | Embedded | 100% of iframe | **Current**: Canvas collapses if parent lacks height; aspect ratio mismatch.<br>**Proposed**: Container scales responsively with `w-full h-full max-w-full max-h-full` preserving letterboxed aspect ratio without collapse. | Perfect embed fit |

---

## 6. Concrete Recommendations for Fixing Requirement R1

### 6.1. Update `index.html` Viewport Meta & Root Resets
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```
In `src/index.css`, ensure root html/body resets:
```css
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

### 6.2. Refactor `App.tsx` Header, Main Wrapper, and Layout
1. **Header responsiveness & In-Game minimization**:
   - In `App.tsx`, change header on mobile: `flex-row justify-between items-center px-2 py-2 sm:px-4 sm:py-3`.
   - Reduce logo and font sizes on mobile (`text-xl sm:text-3xl`, mascot icon `text-xl p-1.5 sm:text-3xl sm:p-3`).
   - When `isPlaying === true`, hide or minimize the header (`isPlaying ? 'hidden' : 'flex'`) on mobile screens to give 100% of the viewport to the game canvas!
2. **Main Wrapper fix**:
   - Change line 680 to:
     ```tsx
     <div className="w-full h-full flex-1 min-h-0 flex flex-col items-center justify-center relative">
     ```
3. **Remove or Make Optional the Portrait Blocker**:
   - Remove the hard blocking overlay or make it a dismissible hint, allowing full gameplay and menu interaction in portrait mode.
4. **Floating Side Wallet Tab**:
   - Add `hidden md:flex` to the floating wallet tab so it doesn't block mobile touch slicing.

### 6.3. Refactor `PizzaCanvas.tsx` Container & Aspect Ratio
1. **Container Styling**:
   Replace:
   ```tsx
   className={`relative w-auto max-w-full h-full max-h-[82vh] aspect-[16/9] mx-auto ...`}
   ```
   With an adaptive container that scales responsively:
   ```tsx
   className={`relative w-full h-full max-w-full max-h-full mx-auto bg-slate-950/95 shadow-2xl flex flex-col border-2 sm:border-[4px] transition-colors duration-150 overflow-hidden ${
     damageFlash ? 'border-red-600 bg-red-950/80' : 'border-amber-500'
   }`}
   style={{
     aspectRatio: '16/9',
     maxWidth: 'min(100%, calc((100vh - 80px) * 16 / 9))',
     maxHeight: 'min(100%, calc(100vw * 9 / 16))',
     clipPath: 'inset(0 round 1rem sm:1.5rem)'
   }}
   ```
   Or dynamically adjust aspect ratio based on orientation (or portrait adaptive layout).

2. **ResizeObserver & Canvas Resolution**:
   In `resizeCanvas`:
   ```tsx
   const resizeCanvas = () => {
     const parent = canvas.parentElement;
     if (parent) {
       const rect = parent.getBoundingClientRect();
       const dpr = Math.min(window.devicePixelRatio || 1, 2);
       const targetWidth = Math.round((rect.width || parent.clientWidth || 375) * dpr);
       const targetHeight = Math.round((rect.height || parent.clientHeight || 500) * dpr);
       if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
         canvas.width = targetWidth;
         canvas.height = targetHeight;
       }
     }
   };
   ```

3. **In-Game HUD Mobile Compactness**:
   - Score & Lives: `px-2.5 py-1 sm:px-5 sm:py-2`, `text-lg sm:text-3xl`.
   - Oven Timer & Audio: `px-2.5 py-1 sm:px-4 sm:py-2`, smaller icons (`w-4 h-4 sm:w-6 sm:h-6`).
   - Hide non-essential badges (e.g. Level badge or Óptico badge) on screens < 500px.

4. **Main Menu Overlay Sizing**:
   - Top Nav Bar: `top-2 inset-x-2 sm:top-4 sm:inset-x-4`, buttons `w-10 h-10 sm:w-14 sm:h-14`.
   - Mascot: `w-20 h-20 sm:w-32 sm:h-32 md:w-48 md:h-48`.
   - Title: `text-2xl sm:text-4xl md:text-5xl`.
   - Play Buttons: `py-2.5 sm:py-3.5 px-4 sm:px-6`, `text-sm sm:text-xl`, minimum touch height 48px.

5. **Modals & Game Over Score Registration**:
   - `scoreRegistrationCard`: Add `max-h-[90vh] overflow-y-auto`, compact padding (`p-4 sm:p-6`), compact input (`py-2.5 text-xl font-vt`), submit button `py-2.5 sm:py-3`.
   - Modals (Knives, Rules, Settings): Ensure `max-h-[80vh] overflow-y-auto` with compact touch targets.

6. **Pointer Event Reliability**:
   - Use `setPointerCapture` on pointer down.
   - Do not cancel slicing on pointer leave when active pointer is tracked.

---

## 7. Verification Matrix for R1

- [ ] Viewport simulation at 375x667 (iPhone SE Portrait): Game container fills available area, start buttons centered, fully visible and clickable, modal registration fully visible.
- [ ] Viewport simulation at 667x375 (iPhone SE Landscape): Header is compact/hidden during game, canvas occupies >=90% of screen height/width, HUD fits across top bar without colliding.
- [ ] Viewport simulation at 390x844 & 844x390 (iPhone 12/13/14): Clean responsive scaling in both orientations.
- [ ] Viewport simulation at 412x915 & 915x412 (Pixel 7 / Android): Clean responsive scaling in both orientations.
- [ ] Iframe embedding test (`<iframe src="..." width="400" height="600">` and `<iframe src="..." width="800" height="500">`): Canvas dynamically sizes to fit iframe dimensions without shrinking to zero or collapsing.
- [ ] UI touch targets verification: All interactive buttons (Start, Modals, Audio, Wallet, Shop, Submit Score) have bounding rects >= 44x44px and respond immediately to touch without layout shifts.
- [ ] `npm run build` and `npm run lint` execute cleanly with 0 TypeScript/build errors.
