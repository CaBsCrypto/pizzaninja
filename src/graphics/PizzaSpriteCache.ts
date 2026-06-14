import { PizzaType, PizzaState } from '../types';

// The size of the cached canvas. 150x150 is plenty for a radius of ~60.
const CACHE_SIZE = 160;
const CACHE_RADIUS = 60;

export type SpriteCacheMap = {
  whole: Record<string, HTMLCanvasElement | OffscreenCanvas>;
  scarred: Record<string, HTMLCanvasElement | OffscreenCanvas>;
  half: Record<string, HTMLCanvasElement | OffscreenCanvas>;
  pineappleWarning?: HTMLCanvasElement | OffscreenCanvas;
};

const createCacheCanvas = (size: number) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  return cvs;
};

// Extracted procedural drawing logic from PizzaCanvas.tsx
const drawProceduralPizza = (
  itemCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  type: PizzaType,
  state: PizzaState,
  radius: number,
  cutsMade = 0
) => {
  const isHalf = state === PizzaState.Half;

  if (type === PizzaType.Pineapple) {
    // 1. Draw Leaf Crown at the top of the body (pointing up relative to rotation)
    itemCtx.fillStyle = '#16a34a'; // rich green leaves
    itemCtx.strokeStyle = '#14532d';
    itemCtx.lineWidth = 2.0;

    // Draw multiple leaves fanning out
    const leafPaths = [
      { x1: 0, y1: -radius * 0.3, cx: -radius * 0.08, cy: -radius * 0.75, x2: 0, y2: -radius * 1.1, cx2: radius * 0.08, cy2: -radius * 0.75 },
      { x1: -radius * 0.15, y1: -radius * 0.3, cx: -radius * 0.4, cy: -radius * 0.65, x2: -radius * 0.38, y2: -radius * 0.9, cx2: -radius * 0.15, cy2: -radius * 0.5 },
      { x1: radius * 0.15, y1: -radius * 0.3, cx: radius * 0.4, cy: -radius * 0.65, x2: radius * 0.38, y2: -radius * 0.9, cx2: radius * 0.15, cy2: -radius * 0.5 },
      { x1: -radius * 0.08, y1: -radius * 0.35, cx: -radius * 0.2, cy: -radius * 0.85, x2: -radius * 0.18, y2: -radius * 1.05, cx2: 0, cy2: -radius * 0.65 },
      { x1: radius * 0.08, y1: -radius * 0.35, cx: radius * 0.2, cy: -radius * 0.85, x2: radius * 0.18, y2: -radius * 1.05, cx2: 0, cy2: -radius * 0.65 },
    ];

    leafPaths.forEach(lp => {
      itemCtx.beginPath();
      itemCtx.moveTo(lp.x1, lp.y1);
      itemCtx.quadraticCurveTo(lp.cx, lp.cy, lp.x2, lp.y2);
      itemCtx.quadraticCurveTo(lp.cx2, lp.cy2, lp.x1, lp.y1);
      itemCtx.fill();
      itemCtx.stroke();
    });

    // 2. Draw Pineapple Body (oval)
    // Create radial gradient for pineapple body
    const bodyGrad = itemCtx.createRadialGradient(0, radius * 0.15, 5, 0, radius * 0.15, radius * 0.75);
    bodyGrad.addColorStop(0, '#facc15'); // central yellow
    bodyGrad.addColorStop(0.7, '#ea580c'); // warm orange edge
    bodyGrad.addColorStop(1, '#9a3412'); // deep reddish shadow

    itemCtx.fillStyle = bodyGrad;
    itemCtx.strokeStyle = '#7c2d12';
    itemCtx.lineWidth = 3;

    itemCtx.beginPath();
    itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
    itemCtx.fill();
    itemCtx.stroke();

    // 3. Draw spiky scales texture
    itemCtx.strokeStyle = 'rgba(124, 45, 18, 0.61)';
    itemCtx.lineWidth = 1.8;
    
    for (let strokePass = 0; strokePass < 2; strokePass++) {
      const sign = strokePass === 0 ? 1 : -1;
      for (let offset = -radius * 0.4; offset <= radius * 0.4; offset += radius * 0.22) {
        itemCtx.save();
        itemCtx.beginPath();
        itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
        itemCtx.clip();
        
        itemCtx.beginPath();
        itemCtx.moveTo(offset - radius * 0.5 * sign, radius * 0.18 - radius * 0.65);
        itemCtx.lineTo(offset + radius * 0.5 * sign, radius * 0.18 + radius * 0.65);
        itemCtx.stroke();
        itemCtx.restore();
      }
    }

    // Draw little brown scale centers (spikes)
    itemCtx.save();
    itemCtx.beginPath();
    itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
    itemCtx.clip();
    
    itemCtx.fillStyle = '#7c2d12';
    const dots = [
      { dx: 0, dy: radius * 0.18 },
      { dx: -radius * 0.2, dy: radius * -0.02 },
      { dx: radius * 0.2, dy: radius * -0.02 },
      { dx: -radius * 0.2, dy: radius * 0.38 },
      { dx: radius * 0.2, dy: radius * 0.38 },
      { dx: 0, dy: radius * -0.15 },
      { dx: 0, dy: radius * 0.51 },
      { dx: -radius * 0.32, dy: radius * 0.18 },
      { dx: radius * 0.32, dy: radius * 0.18 },
    ];
    dots.forEach(d => {
      itemCtx.beginPath();
      itemCtx.moveTo(d.dx - 3, d.dy + 1);
      itemCtx.lineTo(d.dx, d.dy - 5);
      itemCtx.lineTo(d.dx + 3, d.dy + 1);
      itemCtx.fill();
    });
    itemCtx.restore();

    // 4. Draw warning/hazardous details
    itemCtx.fillStyle = '#ef4444';
    itemCtx.strokeStyle = '#ffffff';
    itemCtx.lineWidth = 1.6;
    
    itemCtx.beginPath();
    itemCtx.arc(0, radius * 0.15, 12, 0, Math.PI * 2);
    itemCtx.fill();
    itemCtx.stroke();

    itemCtx.fillStyle = '#ffffff';
    itemCtx.font = '900 13px sans-serif';
    itemCtx.textAlign = 'center';
    itemCtx.textBaseline = 'middle';
    itemCtx.fillText('⚠️', 0, radius * 0.15 + 0.5);

    return;
  }

  if (type === PizzaType.Clock) {
    // 1. Draw a glowing Glassmorphic Stopwatch
    const isHalf = state === PizzaState.Half;
    
    if (isHalf) {
      // Draw shattered/cut clock
      itemCtx.beginPath();
      itemCtx.arc(0, 0, radius * 0.9, -Math.PI / 2, Math.PI / 2);
      itemCtx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // blue glass
      itemCtx.fill();
      
      itemCtx.strokeStyle = '#93c5fd';
      itemCtx.lineWidth = 3;
      itemCtx.stroke();
      
      // Draw cut jagged line
      itemCtx.beginPath();
      itemCtx.moveTo(0, -radius * 0.9);
      itemCtx.lineTo(radius * 0.2, -radius * 0.4);
      itemCtx.lineTo(-radius * 0.1, 0);
      itemCtx.lineTo(radius * 0.2, radius * 0.4);
      itemCtx.lineTo(0, radius * 0.9);
      itemCtx.strokeStyle = '#bfdbfe';
      itemCtx.stroke();
      return;
    }

    // Stopwatch body
    const clockGrad = itemCtx.createRadialGradient(0, -radius * 0.2, 5, 0, 0, radius);
    clockGrad.addColorStop(0, '#60a5fa');
    clockGrad.addColorStop(0.8, '#2563eb');
    clockGrad.addColorStop(1, '#1e3a8a');
    
    itemCtx.beginPath();
    itemCtx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    itemCtx.fillStyle = clockGrad;
    itemCtx.fill();

    // Metallic rim
    itemCtx.strokeStyle = '#bfdbfe';
    itemCtx.lineWidth = radius * 0.12;
    itemCtx.stroke();

    // Top button
    itemCtx.fillStyle = '#94a3b8';
    itemCtx.fillRect(-radius * 0.15, -radius * 1.05, radius * 0.3, radius * 0.2);
    itemCtx.fillStyle = '#cbd5e1';
    itemCtx.fillRect(-radius * 0.2, -radius * 1.15, radius * 0.4, radius * 0.1);

    // Inner dial details
    itemCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    itemCtx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const innerR = i % 3 === 0 ? radius * 0.5 : radius * 0.65;
      itemCtx.beginPath();
      itemCtx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      itemCtx.lineTo(Math.cos(angle) * radius * 0.75, Math.sin(angle) * radius * 0.75);
      itemCtx.stroke();
    }

    // Glowing Hands
    itemCtx.strokeStyle = '#fbbf24'; // gold hand
    itemCtx.lineWidth = 4;
    itemCtx.lineCap = 'round';
    itemCtx.beginPath();
    itemCtx.moveTo(0, 0);
    // Minute hand
    itemCtx.lineTo(radius * 0.45 * Math.cos(-Math.PI / 4), radius * 0.45 * Math.sin(-Math.PI / 4));
    itemCtx.stroke();
    
    itemCtx.strokeStyle = '#ffffff';
    itemCtx.lineWidth = 3;
    itemCtx.beginPath();
    itemCtx.moveTo(0, 0);
    // Hour hand
    itemCtx.lineTo(radius * 0.3 * Math.cos(Math.PI), radius * 0.3 * Math.sin(Math.PI));
    itemCtx.stroke();

    // Center dot
    itemCtx.fillStyle = '#ffffff';
    itemCtx.beginPath();
    itemCtx.arc(0, 0, 5, 0, Math.PI * 2);
    itemCtx.fill();

    return;
  }

  // 1. Toasted Crust
  itemCtx.beginPath();
  if (isHalf) {
    itemCtx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    itemCtx.lineTo(0, -radius);
  } else {
    itemCtx.arc(0, 0, radius, 0, Math.PI * 2);
  }

  if (type === PizzaType.Burnt) {
    itemCtx.fillStyle = '#27272a';
    itemCtx.strokeStyle = '#09090b';
  } else if (type === PizzaType.Golden) {
    // Glowing golden crust
    itemCtx.fillStyle = '#f59e0b';
    itemCtx.strokeStyle = '#b45309';
  } else {
    itemCtx.fillStyle = '#ca8a04';
    itemCtx.strokeStyle = '#78350f';
  }
  itemCtx.lineWidth = 3.5;
  itemCtx.fill();
  itemCtx.stroke();

  // 2. Rich Marinara Tomato Sauce Base
  itemCtx.beginPath();
  const sauceRadius = radius * 0.86;
  if (isHalf) {
    itemCtx.arc(0, 0, sauceRadius, -Math.PI / 2, Math.PI / 2);
    itemCtx.lineTo(0, -sauceRadius);
  } else {
    itemCtx.arc(0, 0, sauceRadius, 0, Math.PI * 2);
  }
  if (type === PizzaType.Burnt) {
    itemCtx.fillStyle = '#18181b';
  } else if (type === PizzaType.Golden) {
    itemCtx.fillStyle = '#fbbf24'; // bright gold base
  } else {
    itemCtx.fillStyle = '#b91c1c';
  }
  itemCtx.fill();

  // 3. Gourmet Creamy Melted Cheese
  itemCtx.beginPath();
  const cheeseRadius = radius * 0.78;
  if (isHalf) {
    itemCtx.arc(0, 0, cheeseRadius, -Math.PI / 2, Math.PI / 2);
    itemCtx.lineTo(0, -cheeseRadius);
  } else {
    itemCtx.arc(0, 0, cheeseRadius, 0, Math.PI * 2);
  }

  if (type === PizzaType.Burnt) {
    itemCtx.fillStyle = '#3f3f46';
  } else if (type === PizzaType.FourCheese) {
    itemCtx.fillStyle = '#fef08a';
  } else if (type === PizzaType.Veggie) {
    itemCtx.fillStyle = '#fffbeb';
  } else if (type === PizzaType.Golden) {
    itemCtx.fillStyle = '#fef08a'; // brilliant light gold cheese
  } else {
    itemCtx.fillStyle = '#fde047';
  }
  itemCtx.fill();

  // 4. Subtle toasted oven bubbles
  if (type !== PizzaType.Burnt) {
    itemCtx.fillStyle = 'rgba(146, 64, 14, 0.4)';
    const spots = isHalf 
      ? [{ r: radius * 0.25, a: 0.2 }, { r: radius * 0.45, a: -0.5 }, { r: radius * 0.5, a: 0.6 }] 
      : [{ r: radius * 0.15, a: 0.3 }, { r: radius * 0.4, a: -0.9 }, { r: radius * 0.5, a: 1.5 }, { r: radius * 0.3, a: 3.1 }];
    
    spots.forEach(spot => {
      const sx = Math.cos(spot.a) * spot.r;
      const sy = Math.sin(spot.a) * spot.r;
      itemCtx.beginPath();
      itemCtx.arc(sx, sy, radius * 0.08, 0, Math.PI * 2);
      itemCtx.fill();
    });
  }

  // 5. Chef Ingredient Toppings
  if (type === PizzaType.Pepperoni) {
    itemCtx.fillStyle = '#991b1b';
    itemCtx.strokeStyle = '#7f1d1d';
    itemCtx.lineWidth = 1;

    const peps = isHalf 
      ? [{ r: radius * 0.4, a: -0.2 }, { r: radius * 0.45, a: 0.8 }, { r: radius * 0.2, a: 0.3 }]
      : [{ r: radius * 0.4, a: -0.4 }, { r: radius * 0.45, a: 0.8 }, { r: radius * 0.48, a: 2.2 }, { r: radius * 0.32, a: -2.3 }, { r: radius * 0.2, a: 1.1 }];
    
    peps.forEach(p => {
      const px = Math.cos(p.a) * p.r;
      const py = Math.sin(p.a) * p.r;
      
      itemCtx.beginPath();
      itemCtx.arc(px, py, radius * 0.14, 0, Math.PI * 2);
      itemCtx.fill();
      itemCtx.stroke();

      itemCtx.beginPath();
      itemCtx.fillStyle = '#dc2626';
      itemCtx.arc(px, py, radius * 0.1, 0, Math.PI * 2);
      itemCtx.fill();
    });
  } else if (type === PizzaType.Veggie) {
    const items = isHalf
      ? [{ r: radius * 0.3, a: -0.4, item: 'pepper' }, { r: radius * 0.45, a: 0.7, item: 'olive' }, { r: radius * 0.4, a: 0.1, item: 'onion' }]
      : [{ r: radius * 0.3, a: -0.5, item: 'pepper' }, { r: radius * 0.45, a: 0.8, item: 'pepper' }, { r: radius * 0.5, a: -2.2, item: 'olive' }, { r: radius * 0.28, a: 2.5, item: 'olive' }, { r: radius * 0.4, a: 1.4, item: 'onion' }];

    items.forEach(it => {
      const ix = Math.cos(it.a) * it.r;
      const iy = Math.sin(it.a) * it.r;

      if (it.item === 'pepper') {
        itemCtx.strokeStyle = '#16a34a';
        itemCtx.lineWidth = 3;
        itemCtx.lineCap = 'round';
        itemCtx.beginPath();
        itemCtx.arc(ix, iy, radius * 0.1, 0, Math.PI * 0.61);
        itemCtx.stroke();
      } else if (it.item === 'olive') {
        itemCtx.fillStyle = '#0f172a';
        itemCtx.beginPath();
        itemCtx.arc(ix, iy, radius * 0.08, 0, Math.PI * 2);
        itemCtx.fill();

        itemCtx.fillStyle = '#fffbeb';
        itemCtx.beginPath();
        itemCtx.arc(ix, iy, radius * 0.03, 0, Math.PI * 2);
        itemCtx.fill();
      } else if (it.item === 'onion') {
        itemCtx.strokeStyle = '#c084fc';
        itemCtx.lineWidth = 2;
        itemCtx.beginPath();
        itemCtx.arc(ix, iy, radius * 0.11, 0, Math.PI * 0.8);
        itemCtx.stroke();
      }
    });
  } else if (type === PizzaType.FourCheese) {
    itemCtx.fillStyle = '#f97316';
    const pockets = isHalf 
      ? [{ r: radius * 0.35, a: 0.5 }, { r: radius * 0.42, a: -0.4 }]
      : [{ r: radius * 0.35, a: 0.5 }, { r: radius * 0.42, a: -0.4 }, { r: radius * 0.5, a: 2.3 }, { r: radius * 0.12, a: -1.9 }];
    
    pockets.forEach(pkt => {
      const px = Math.cos(pkt.a) * pkt.r;
      const py = Math.sin(pkt.a) * pkt.r;
      itemCtx.beginPath();
      itemCtx.arc(px, py, radius * 0.13, 0, Math.PI * 2);
      itemCtx.fill();
    });

    itemCtx.fillStyle = '#22c55e';
    const sprCount = isHalf ? 8 : 16;
    for (let i = 0; i < sprCount; i++) {
      const sprAngle = (i / sprCount) * Math.PI * 2 + Math.random() * 0.3;
      const sprDist = (0.2 + 0.45 * Math.random()) * radius;
      itemCtx.fillRect(Math.cos(sprAngle) * sprDist, Math.sin(sprAngle) * sprDist, 2.5, 2.5);
    }
  } else if (type === PizzaType.Golden) {
    // 5. Draw diamond-shaped golden ingots/pepperonis and star sparkles
    itemCtx.fillStyle = '#d97706';
    itemCtx.strokeStyle = '#b45309';
    itemCtx.lineWidth = 2;
    
    const ingots = isHalf 
      ? [{ r: radius * 0.4, a: -0.2 }, { r: radius * 0.5, a: 0.8 }]
      : [{ r: radius * 0.35, a: 0 }, { r: radius * 0.45, a: 1.2 }, { r: radius * 0.4, a: 2.5 }, { r: radius * 0.5, a: 4.0 }];
      
    ingots.forEach(p => {
      const px = Math.cos(p.a) * p.r;
      const py = Math.sin(p.a) * p.r;
      
      // Draw shiny star/diamond
      itemCtx.save();
      itemCtx.translate(px, py);
      itemCtx.rotate(p.a);
      itemCtx.beginPath();
      itemCtx.moveTo(0, -radius * 0.15);
      itemCtx.lineTo(radius * 0.08, 0);
      itemCtx.lineTo(0, radius * 0.15);
      itemCtx.lineTo(-radius * 0.08, 0);
      itemCtx.closePath();
      itemCtx.fill();
      itemCtx.stroke();
      itemCtx.restore();
    });

    // Sparkles
    itemCtx.fillStyle = '#ffffff';
    for(let i=0; i< (isHalf ? 3 : 6); i++) {
       const sa = Math.random() * Math.PI * 2;
       const sr = Math.random() * radius * 0.7;
       itemCtx.beginPath();
       itemCtx.arc(Math.cos(sa)*sr, Math.sin(sa)*sr, 2, 0, Math.PI*2);
       itemCtx.fill();
    }
  }

  // 6. Dashed line highlighting perfect slice cuts
  if (type !== PizzaType.Burnt) {
    itemCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    itemCtx.lineWidth = 1.8;
    itemCtx.setLineDash([5, 5]);
    itemCtx.beginPath();
    if (isHalf) {
      itemCtx.moveTo(0, 0);
      itemCtx.lineTo(radius * 0.95 * Math.cos(-Math.PI / 4), radius * 0.95 * Math.sin(-Math.PI / 4));
      itemCtx.moveTo(0, 0);
      itemCtx.lineTo(radius * 0.95 * Math.cos(Math.PI / 4), radius * 0.95 * Math.sin(Math.PI / 4));
    } else {
      itemCtx.moveTo(-radius * 0.9, 0);
      itemCtx.lineTo(radius * 0.9, 0);
      itemCtx.moveTo(0, -radius * 0.9);
      itemCtx.lineTo(0, radius * 0.9);
    }
    itemCtx.stroke();
    itemCtx.setLineDash([]);
  }

  // 7. Visual sliced scar if cut once
  if (!isHalf && cutsMade === 1) {
    itemCtx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    itemCtx.lineWidth = 4;
    itemCtx.beginPath();
    itemCtx.moveTo(-radius * 0.95, 0);
    itemCtx.lineTo(radius * 0.95, 0);
    itemCtx.stroke();

    itemCtx.fillStyle = '#fde047';
    itemCtx.beginPath();
    itemCtx.arc(radius * 0.3, 0, 3, 0, Math.PI * 2);
    itemCtx.arc(-radius * 0.4, 0, 3.5, 0, Math.PI * 2);
    itemCtx.fill();

    itemCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    itemCtx.lineWidth = 1.6;
    itemCtx.beginPath();
    itemCtx.moveTo(-radius * 0.9, 0);
    itemCtx.lineTo(radius * 0.9, 0);
    itemCtx.stroke();
  }
};

let cachedMap: SpriteCacheMap | null = null;

export const getSpriteCache = (): SpriteCacheMap => {
  if (cachedMap) return cachedMap;

  const map: SpriteCacheMap = {
    whole: {},
    scarred: {},
    half: {}
  };

  const center = CACHE_SIZE / 2;

  // Build Warning Glow for Pineapple
  const warningCanvas = createCacheCanvas(CACHE_SIZE);
  const wctx = warningCanvas.getContext('2d') as CanvasRenderingContext2D;
  const warningGrad = wctx.createRadialGradient(center, center, CACHE_RADIUS * 0.2, center, center, CACHE_RADIUS * 1.15);
  warningGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
  warningGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.18)');
  warningGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  wctx.fillStyle = warningGrad;
  wctx.beginPath();
  wctx.arc(center, center, CACHE_RADIUS * 1.15, 0, Math.PI * 2);
  wctx.fill();
  map.pineappleWarning = warningCanvas;

  const types = [PizzaType.Pepperoni, PizzaType.Veggie, PizzaType.FourCheese, PizzaType.Pineapple, PizzaType.Burnt, PizzaType.Golden, PizzaType.Clock];

  types.forEach(t => {
    // Whole
    const cWhole = createCacheCanvas(CACHE_SIZE);
    const ctxW = cWhole.getContext('2d') as CanvasRenderingContext2D;
    ctxW.translate(center, center);
    drawProceduralPizza(ctxW, t, PizzaState.Whole, CACHE_RADIUS, 0);
    map.whole[t] = cWhole;

    // Scarred (1 cut)
    const cScar = createCacheCanvas(CACHE_SIZE);
    const ctxS = cScar.getContext('2d') as CanvasRenderingContext2D;
    ctxS.translate(center, center);
    drawProceduralPizza(ctxS, t, PizzaState.Whole, CACHE_RADIUS, 1);
    map.scarred[t] = cScar;

    // Half
    const cHalf = createCacheCanvas(CACHE_SIZE);
    const ctxH = cHalf.getContext('2d') as CanvasRenderingContext2D;
    ctxH.translate(center, center);
    drawProceduralPizza(ctxH, t, PizzaState.Half, CACHE_RADIUS, 0);
    map.half[t] = cHalf;
  });

  cachedMap = map;
  return map;
};

// Also export the slice helper because it uses the cache now
export const drawCachedPizzaSlice = (
  ctx: CanvasRenderingContext2D,
  cache: SpriteCacheMap,
  type: PizzaType,
  radius: number,
  startAngle: number,
  endAngle: number,
  alpha: number
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  
  // Create clipping wedge
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.clip();

  // Draw cached whole pizza inside the wedge
  const sprite = cache.whole[type];
  if (sprite) {
    ctx.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
  }

  // Draw the cut borders (optional for visual depth)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(endAngle) * radius, Math.sin(endAngle) * radius);
  ctx.lineWidth = 3;
  ctx.strokeStyle = type === PizzaType.Burnt ? '#09090b' : '#78350f';
  ctx.stroke();

  ctx.restore();
};
