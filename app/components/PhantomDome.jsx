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

  // ── Inertia loop ───────────────────────────────────────────────
  const tick = useCallback(() => {
    if (!draggingRef.current) {
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
  }, [applyTransform, clampY, clampX, maxRotY, maxTilt, maybeShiftWindow]);

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
    applyTransform();
  }, [resetKey, initialOffsetDeg, applyTransform]);

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

  // Report the current window's story range to the parent for the indicator.
  // Deps are value-stable (numbers) so this fires only when the window actually
  // moves — not on every parent re-render.
  useEffect(() => {
    if (!onWindowChange) return;
    const start = Math.min(baseCol, maxBaseCol);
    const total = items.length;
    const from = total > 0 ? Math.min(start * MAX_ROWS + 1, total) : 0;
    const to = total > 0 ? Math.min((start + windowCols) * MAX_ROWS, total) : 0;
    onWindowChange({ from, to, total });
  }, [baseCol, windowCols, maxBaseCol, items.length, onWindowChange]);

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
