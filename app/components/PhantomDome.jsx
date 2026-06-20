'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

const LEFT_ANCHOR_DEG = -72;
const MAX_ROWS = 3;
// How many columns of off-screen buffer must remain on each side before the
// window silently slides. Big enough that the reset always happens off-screen.
const EDGE_BUFFER_COLS = 6;

/**
 * PhantomDome — a full-bleed spherical "video wall".
 *
 * Cards are uniform tiles placed on the inside of a cylinder via
 * rotateY(lon) rotateX(lat) translateZ(-R).
 *
 * ENDLESS SCROLL via a sliding window:
 * Only a fixed number of columns (≤ one cylinder turn, so never overlapping)
 * are rendered at a time, at FIXED angular positions. A `baseCol` offset picks
 * which slice of the full list those columns show. As the user scrolls and a
 * side's off-screen buffer runs low, the window slides (`baseCol += K`) AND
 * `rotY` is wound back by `K × colStep`. Because the tiles are evenly spaced,
 * this combined reset is mathematically invisible — every tile lands where
 * another already was, showing that tile's old content — so it reads as smooth
 * infinite scrolling through the entire list.
 *
 * Props:
 *  - items          : FULL data array (the component windows it internally)
 *  - renderItem     : (item, index) => ReactNode
 *  - resetKey       : change this (e.g. on filter change) to jump back to start
 *  - cardWidth/cardHeight/radius/anglePerColumn/maxArc/maxTilt : geometry
 */
export default function PhantomDome({
  items = [],
  renderItem,
  resetKey,
  zones,
  flyNonce = 0,
  flyTargetCol = 0,
  cardWidth = 320,
  cardHeight = 320,
  radius = 2100,
  anglePerColumn = 13,
  maxArc = 300,
  maxTilt = 34,
  className = '',
  initialOffsetDeg = 90,
  verticalDamping = 1,
  onWindowChange,
}) {
  const stageRef = useRef(null);

  // ── Fixed geometry ─────────────────────────────────────────────
  const { colStep, rowStep, windowCols, totalCols, maxBaseCol, rightEdgeDeg, minRotY, maxRotY } = useMemo(() => {
    const RAD = 180 / Math.PI;
    const gapPx = 30;
    const rowGapPx = 26;
    const colStep_ = Math.min(anglePerColumn, ((cardWidth + gapPx) / radius) * RAD);
    const rowStep_ = ((cardHeight + rowGapPx) / radius) * RAD;
    const totalCols_ = Math.max(1, Math.ceil(items.length / MAX_ROWS));
    // Fixed window: fills the arc but stays under one full turn (no overlap).
    const windowCols_ = Math.max(6, Math.floor(maxArc / colStep_));
    const maxBaseCol_ = Math.max(0, totalCols_ - windowCols_);
    const minRotY_ = -LEFT_ANCHOR_DEG; // col 0 centred = scroll floor
    const rightEdgeDeg_ = -LEFT_ANCHOR_DEG + (windowCols_ - 1) * colStep_;
    const maxRotY_ = rightEdgeDeg_ + 10;
    return {
      colStep: colStep_, rowStep: rowStep_, windowCols: windowCols_,
      totalCols: totalCols_, maxBaseCol: maxBaseCol_,
      rightEdgeDeg: rightEdgeDeg_, minRotY: minRotY_, maxRotY: maxRotY_,
    };
  }, [items, cardWidth, cardHeight, radius, anglePerColumn, maxArc]);

  // ── Scroll + window state ──────────────────────────────────────
  const rotYRef = useRef(initialOffsetDeg);
  const velYRef = useRef(0);
  const rotXRef = useRef(0);
  const velXRef = useRef(0);
  const baseColRef = useRef(0);
  const [baseCol, setBaseCol] = useState(0);

  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  // Fly-to-zone animation state. lockBaseRef holds the dome on the target zone
  // after a fly until the user actively drags/scrolls (otherwise the auto
  // recenter would immediately slide away from the zone start).
  const flyAnimRef = useRef(null);
  const lockBaseRef = useRef(false);

  const clampY = useCallback((v) => Math.max(minRotY, Math.min(maxRotY, v)), [minRotY, maxRotY]);
  const clampX = useCallback((v) => Math.max(-maxTilt, Math.min(maxTilt, v)), [maxTilt]);

  const applyTransform = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const s = Math.max(0.55, Math.min(w / 2130, 1));
      stage.style.transform =
        `translateZ(${radius}px) rotateX(${rotXRef.current}deg) rotateY(${rotYRef.current}deg) scale(${s})`;
    }
  }, [radius]);

  // The seamless window slide. `cCenter` is the rendered column currently at the
  // screen centre. When a side's buffer runs low (and more content exists that
  // way), slide the window by K columns and compensate rotY so nothing visibly
  // moves.
  const maybeShiftWindow = useCallback(() => {
    if (lockBaseRef.current) return; // holding a zone after a fly
    const cCenter = (LEFT_ANCHOR_DEG + rotYRef.current) / colStep;
    if (cCenter > windowCols - EDGE_BUFFER_COLS && baseColRef.current < maxBaseCol) {
      const K = Math.min(Math.max(1, Math.round(cCenter - windowCols / 2)), maxBaseCol - baseColRef.current);
      if (K > 0) {
        baseColRef.current += K;
        rotYRef.current = clampY(rotYRef.current - K * colStep);
        setBaseCol(baseColRef.current);
      }
    } else if (cCenter < EDGE_BUFFER_COLS && baseColRef.current > 0) {
      const K = Math.min(Math.max(1, Math.round(windowCols / 2 - cCenter)), baseColRef.current);
      if (K > 0) {
        baseColRef.current -= K;
        rotYRef.current = clampY(rotYRef.current + K * colStep);
        setBaseCol(baseColRef.current);
      }
    }
  }, [colStep, windowCols, maxBaseCol, clampY]);

  // Report the current window + the zone under the SCREEN CENTRE to the parent.
  // Skipped mid-flight so the indicator never flashes the pre-fly zone; the
  // final report is fired from the tick when the tween completes. `zones` is
  // read via a ref so this callback (and thus the tick) stays referentially
  // stable across renders.
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const reportWindow = useCallback(() => {
    if (!onWindowChange) return;
    if (flyAnimRef.current) return;
    const start = Math.min(baseColRef.current, maxBaseCol);
    const total = items.length;
    const from = total > 0 ? Math.min(start * MAX_ROWS + 1, total) : 0;
    const to = total > 0 ? Math.min((start + windowCols) * MAX_ROWS, total) : 0;
    const cCenter = (LEFT_ANCHOR_DEG + rotYRef.current) / colStep;
    const centeredFullCol = Math.round(start + cCenter);
    let zone = null;
    const zs = zonesRef.current;
    if (zs && zs.length) {
      for (const z of zs) {
        const end = z.startCol + Math.max(1, Math.ceil(z.count / MAX_ROWS));
        if (centeredFullCol >= z.startCol && centeredFullCol < end) { zone = z.category; break; }
      }
    }
    onWindowChange({ from, to, total, zone });
  }, [onWindowChange, maxBaseCol, items.length, windowCols]);

  // ── Inertia loop ───────────────────────────────────────────────
  const tick = useCallback(() => {
    if (flyAnimRef.current) {
      // Fly-to-zone tween in progress — it owns rotY; skip inertia/shift.
      const a = flyAnimRef.current;
      const t = Math.min(1, (performance.now() - a.start) / a.dur);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      rotYRef.current = a.fromRot + (a.toRot - a.fromRot) * e;
      if (t >= 1) {
        flyAnimRef.current = null;
        reportWindow(); // rotY has settled on the zone — report the correct zone now
      }
      applyTransform();
    } else if (!draggingRef.current) {
      const friction = 0.92;
      const stop = 0.002;

      velYRef.current *= friction;
      if (Math.abs(velYRef.current) < stop) velYRef.current = 0;
      rotYRef.current = clampY(rotYRef.current + velYRef.current);
      if (rotYRef.current >= maxRotY) velYRef.current *= -0.25;
      maybeShiftWindow();

      velXRef.current *= friction;
      if (Math.abs(velXRef.current) < stop) velXRef.current = 0;
      rotXRef.current = clampX(rotXRef.current + velXRef.current);
      if (Math.abs(rotXRef.current) >= maxTilt) velXRef.current *= -0.25;

      applyTransform();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform, clampY, clampX, maxRotY, maxTilt, maybeShiftWindow, reportWindow]);

  useEffect(() => {
    applyTransform();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyTransform, tick]);

  // Reset to the start whenever the filter/data set changes.
  useEffect(() => {
    baseColRef.current = 0;
    setBaseCol(0);
    rotYRef.current = initialOffsetDeg;
    velYRef.current = 0;
    flyAnimRef.current = null;
    lockBaseRef.current = false;
    applyTransform();
  }, [resetKey, initialOffsetDeg, applyTransform]);

  // Fly to a zone: snap baseCol so the zone is in the window, then tween rotY
  // so the zone's FIRST column lands at the same screen spot as a fresh start
  // (the left edge). For the last zone, baseCol clamps to maxBaseCol and the
  // zone start sits partway into the window, so we offset rotY by that amount.
  useEffect(() => {
    if (flyNonce <= 0) return;
    const targetBase = Math.max(0, Math.min(flyTargetCol, maxBaseCol));
    const zoneStartRenderedCol = Math.max(0, flyTargetCol - targetBase);
    const toRot = Math.max(
      minRotY,
      Math.min(maxRotY, initialOffsetDeg + zoneStartRenderedCol * colStep),
    );
    baseColRef.current = targetBase;
    setBaseCol(targetBase);
    velYRef.current = 0;
    lockBaseRef.current = true;
    flyAnimRef.current = {
      fromRot: rotYRef.current,
      toRot,
      start: performance.now(),
      dur: 650,
    };
  }, [flyNonce, flyTargetCol, maxBaseCol, minRotY, maxRotY, colStep, initialOffsetDeg]);

  // Keep baseCol valid if the list shrinks.
  useEffect(() => {
    if (baseColRef.current > maxBaseCol) {
      baseColRef.current = maxBaseCol;
      setBaseCol(maxBaseCol);
    }
  }, [maxBaseCol]);

  // ── Pointer drag (both axes) ───────────────────────────────────
  useEffect(() => {
    const el = stageRef.current?.parentElement;
    if (!el) return;

    function onDown(e) {
      if (e.target.closest('a, button')) return;
      draggingRef.current = true;
      lockBaseRef.current = false; // user took control — allow sliding again
      flyAnimRef.current = null;
      setGrabbing(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      velYRef.current = 0;
      velXRef.current = 0;
      el.setPointerCapture?.(e.pointerId);
    }

    function onMove(e) {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };

      const sens = 0.06;
      rotYRef.current = clampY(rotYRef.current + dx * sens);
      velYRef.current = dx * sens;
      maybeShiftWindow();

      const dX = -dy * sens * (verticalDamping ?? 1);
      rotXRef.current = clampX(rotXRef.current + dX);
      velXRef.current = dX;

      applyTransform();
    }

    function onUp(e) {
      draggingRef.current = false;
      setGrabbing(false);
      el.releasePointerCapture?.(e.pointerId);
    }

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [applyTransform, clampY, clampX, maybeShiftWindow]);

  // ── Wheel (both axes) ──────────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current?.parentElement;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      lockBaseRef.current = false; // user took control — allow sliding again
      const sens = 0.03;
      if (e.deltaX || e.shiftKey) velYRef.current += (e.deltaX || e.deltaY) * sens;
      if (e.deltaY && !e.shiftKey) velXRef.current += e.deltaY * sens * (verticalDamping ?? 1);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Windowed columns (content slides; positions are fixed) ─────
  const windowed = useMemo(() => {
    const start = Math.min(baseCol, maxBaseCol);
    const cols = [];
    for (let c = 0; c < windowCols; c++) {
      const fullCol = start + c;
      const bucket = [];
      for (let row = 0; row < MAX_ROWS; row++) {
        const idx = fullCol * MAX_ROWS + row;
        if (idx < items.length) bucket.push({ item: items[idx], index: idx });
      }
      if (bucket.length > 0) cols.push({ c, bucket });
    }
    return cols;
  }, [items, baseCol, windowCols, maxBaseCol]);

  const atStart = baseCol <= 0;
  const atEnd = baseCol >= maxBaseCol && totalCols <= windowCols ? false : baseCol >= maxBaseCol;

  // Zone boundary gates: a divider at each zone boundary currently in view
  // (skipping the first zone, which has no preceding boundary).
  const windowStart = Math.min(baseCol, maxBaseCol);
  const gates = [];
  if (zones && zones.length > 1) {
    for (let i = 1; i < zones.length; i++) {
      const z = zones[i];
      const renderedCol = z.startCol - windowStart;
      if (renderedCol > -1 && renderedCol < windowCols + 1) {
        gates.push({
          key: z.category,
          label: z.category,
          color: z.color,
          lon: LEFT_ANCHOR_DEG - (renderedCol - 0.5) * colStep,
        });
      }
    }
  }

  // Report when the window moves (baseCol shifts during scroll). The fly's own
  // arrival report fires from the tick; reportWindow skips while in flight.
  useEffect(() => {
    reportWindow();
  }, [baseCol, reportWindow]);

  return (
    <div
      className={`phantom-cylinder-viewport ${className}`}
      style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
    >
      <div className="phantom-cylinder-scene">
        <div ref={stageRef} className="phantom-cylinder-stage">
          {windowed.map(({ c, bucket }) => {
            const lon = LEFT_ANCHOR_DEG - c * colStep;
            const midRow = (bucket.length - 1) / 2;
            return bucket.map(({ item, index }, row) => {
              const lat = (row - midRow) * rowStep;
              // Position-based key: a window slide changes content, not the
              // tile, so React reuses the DOM node (no re-fade, seamless).
              return (
                <div
                  key={`pos-${c}-${row}`}
                  className="phantom-tile phantom-animate"
                  style={{
                    width: `${cardWidth}px`,
                    height: `${cardHeight}px`,
                    marginLeft: `-${cardWidth / 2}px`,
                    marginTop: `-${cardHeight / 2}px`,
                    '--tile-rot': `rotateY(${lon}deg) rotateX(${lat}deg)`,
                    '--tile-z': `${-radius}px`,
                    transform: `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(${-radius}px)`,
                    animationDelay: `${Math.min(c * 0.03, 0.4)}s`,
                  }}
                >
                  {renderItem(item, index)}
                </div>
              );
            });
          })}
          {gates.map(g => (
            <div
              key={`gate-${g.key}`}
              className="phantom-zone-gate"
              style={{
                width: '16px',
                height: `${cardHeight}px`,
                marginLeft: '-8px',
                marginTop: `-${cardHeight / 2}px`,
                background: g.color,
                transform: `rotateY(${g.lon}deg) translateZ(${-radius + 140}px)`,
              }}
            >
              <span className="phantom-zone-gate-label">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge fade cues when the true start/end of the list is reached */}
      {atStart && <div className="phantom-edge-cue phantom-edge-cue-left" aria-hidden="true">start</div>}
      {atEnd && <div className="phantom-edge-cue phantom-edge-cue-right" aria-hidden="true">end</div>}

      {/* Edge vignettes — all four sides for the spherical enclosure */}
      <div className="phantom-vignette-left" aria-hidden="true" />
      <div className="phantom-vignette-right" aria-hidden="true" />
      <div className="phantom-vignette-top" aria-hidden="true" />
      <div className="phantom-vignette-bottom" aria-hidden="true" />
    </div>
  );
}
