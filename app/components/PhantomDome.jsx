'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * PhantomDome — a full-bleed spherical "video wall" inspired by phantom.land.
 *
 * Every card is a uniform-size tile placed on the inside surface of a sphere
 * using lat/long rotation:  rotateY(longitude) rotateX(latitude) translateZ(-R).
 * Because each tile is pushed out to the same radius and faces the centre, the
 * wall reads as a true curved surface in BOTH axes — no skew, no overlap.
 *
 * The viewer sits at the centre. Dragging (or scrolling) spins the sphere on
 * both axes with momentum / inertia.
 *
 * Angular spacing is derived from the tile size and radius (arcLength = size),
 * so neighbouring tiles touch but never collide regardless of content.
 *
 * Props:
 *  - items          : data array
 *  - renderItem     : (item, index) => ReactNode  (rendered at fixed size)
 *  - cardWidth      : tile width  (px)
 *  - cardHeight     : tile height (px)
 *  - radius         : sphere radius (px)
 *  - anglePerColumn : max degrees between columns (longitude step, clamped by maxArc)
 *  - maxArc         : max total horizontal arc (deg)
 *  - maxTilt        : max vertical tilt from drag (deg)
 */
export default function PhantomDome({
  items = [],
  renderItem,
  cardWidth = 320,
  cardHeight = 320,
  radius = 2100,
  anglePerColumn = 13,
  maxArc = 150,
  maxTilt = 34,
  className = '',
}) {
  const stageRef = useRef(null);

  const rotYRef = useRef(0);   // longitude spin (horizontal)
  const velYRef = useRef(0);
  const rotXRef = useRef(0);   // latitude spin (vertical)
  const velXRef = useRef(0);

  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  // ── Grid sizing ────────────────────────────────────────────────
  const RAD = 180 / Math.PI;
  const MAX_ROWS = 4;
  const gapPx = 36;
  const rowGapPx = 52;
  const colStep = Math.min(anglePerColumn, ((cardWidth + gapPx) / radius) * RAD);
  const rowStep = ((cardHeight + rowGapPx) / radius) * RAD;

  // Respect both the geometric arc limit and the row-cap.
  const maxColsByArc = Math.floor(maxArc / colStep) + 1;
  const neededCols = Math.ceil(items.length / MAX_ROWS);
  const columnCount = Math.max(3, Math.min(maxColsByArc, neededCols));

  // Distribute items column-major (fill each column top-to-bottom first)
  const columns = Array.from({ length: columnCount }, () => []);
  items.forEach((item, i) => {
    const col = Math.floor(i / MAX_ROWS);
    if (col < columnCount) columns[col].push({ item, index: i });
  });

  const midCol = (columnCount - 1) / 2;

  // ── Transform application ──────────────────────────────────────
  const applyTransform = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.style.transform =
        `translateZ(${radius}px) rotateX(${rotXRef.current}deg) rotateY(${rotYRef.current}deg)`;
    }
  }, [radius]);

  const maxRotY = midCol * colStep + 14;
  const clampY = useCallback((v) => Math.max(-maxRotY, Math.min(maxRotY, v)), [maxRotY]);
  const clampX = useCallback((v) => Math.max(-maxTilt, Math.min(maxTilt, v)), [maxTilt]);

  // ── Inertia loop ───────────────────────────────────────────────
  const tick = useCallback(() => {
    if (!draggingRef.current) {
      const friction = 0.92;
      const stop = 0.002;

      velYRef.current *= friction;
      if (Math.abs(velYRef.current) < stop) velYRef.current = 0;
      rotYRef.current = clampY(rotYRef.current + velYRef.current);
      if (Math.abs(rotYRef.current) >= maxRotY) velYRef.current *= -0.25;

      velXRef.current *= friction;
      if (Math.abs(velXRef.current) < stop) velXRef.current = 0;
      rotXRef.current = clampX(rotXRef.current + velXRef.current);
      if (Math.abs(rotXRef.current) >= maxTilt) velXRef.current *= -0.25;

      applyTransform();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform, clampY, clampX, maxRotY, maxTilt]);

  useEffect(() => {
    applyTransform();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [applyTransform, tick]);

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
      const dY = dx * sens;        // drag right → longitude +
      rotYRef.current = clampY(rotYRef.current + dY);
      velYRef.current = dY;

      const dX = -dy * sens;       // drag down → tilt up (reveal top)
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
  }, [applyTransform, clampY, clampX]);

  // ── Wheel (both axes) ──────────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current?.parentElement;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const sens = 0.03;
      if (e.deltaX || e.shiftKey) velYRef.current += (e.deltaX || e.deltaY) * sens;
      if (e.deltaY && !e.shiftKey) velXRef.current += e.deltaY * sens;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Render: every card is a sphere-placed tile ─────────────────
  return (
    <div
      className={`phantom-cylinder-viewport ${className}`}
      style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
    >
      <div className="phantom-cylinder-scene">
        <div ref={stageRef} className="phantom-cylinder-stage">
          {columns.map((bucket, col) => {
            const lon = (col - midCol) * colStep;
            const midRow = (bucket.length - 1) / 2;
            return bucket.map(({ item, index }, row) => {
              const lat = (row - midRow) * rowStep;
              return (
                <div
                  key={index}
                  className="phantom-tile phantom-animate"
                  style={{
                    width: `${cardWidth}px`,
                    height: `${cardHeight}px`,
                    marginLeft: `-${cardWidth / 2}px`,
                    marginTop: `-${cardHeight / 2}px`,
                    // lat/long placement: rotate to position, then push to surface.
                    // Rotation and depth are split so hover can pop the tile
                    // toward the viewer while preserving its orientation.
                    '--tile-rot': `rotateY(${lon}deg) rotateX(${lat}deg)`,
                    '--tile-z': `${-radius}px`,
                    transform: `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(${-radius}px)`,
                    animationDelay: `${Math.min(index * 0.02, 0.5)}s`,
                  }}
                >
                  {renderItem(item, index)}
                </div>
              );
            });
          })}
        </div>
      </div>

      {/* Edge vignettes — all four sides for the spherical enclosure */}
      <div className="phantom-vignette-left" aria-hidden="true" />
      <div className="phantom-vignette-right" aria-hidden="true" />
      <div className="phantom-vignette-top" aria-hidden="true" />
      <div className="phantom-vignette-bottom" aria-hidden="true" />
    </div>
  );
}
