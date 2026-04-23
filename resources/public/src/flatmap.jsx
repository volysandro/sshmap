/* global React */
// Flat equirectangular map with arcs.

const { useRef, useEffect } = React;

function project2D(lat, lng, w, h, pad = 20) {
  const x = pad + ((lng + 180) / 360) * (w - 2 * pad);
  const y = pad + ((90 - lat) / 180) * (h - 2 * pad);
  return { x, y };
}

function pickColorFM(name) {
  const map = {
    cyan:    "rgba(120, 230, 255, ",
    magenta: "rgba(255, 110, 220, ",
    green:   "rgba(120, 255, 180, ",
    amber:   "rgba(255, 200, 100, ",
    white:   "rgba(220, 235, 255, ",
    red:     "rgba(255, 120, 130, ",
  };
  return map[name] || map.cyan;
}

function FlatMap({
  origin, sessions, filteredIds,
  accent = "cyan", secondary = "magenta",
  showGraticule = true,
  dotDensity = "medium",
  arcStyle = "glow",
  hoveredId, onHover, onSelect,
  selectedId,
}) {
  const canvasRef = useRef(null);
  const tRef      = useRef(0);
  const sizeRef   = useRef({ w: 0, h: 0, dpr: 1 });

  // All props land here on every render; the animation loop reads from this ref
  // so live data updates never restart the canvas effect.
  const propsRef = useRef({});
  propsRef.current = { sessions, origin, filteredIds, accent, secondary, showGraticule, dotDensity, arcStyle, hoveredId, selectedId, onHover, onSelect };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    let last = performance.now();

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.parentElement.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // arc as bezier with a lifted midpoint; returns array of {x,y}
    function bezierArc(a, b, w, h, segs = 60) {
      const pA = project2D(a.lat, a.lng, w, h);
      const pB = project2D(b.lat, b.lng, w, h);

      const dx = pB.x - pA.x;
      const plainDist = Math.abs(dx);
      const wrapDist = (w - 40) - plainDist;
      const useWrap = wrapDist < plainDist;

      function build(start, end) {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        const lift = Math.min(140, dist * 0.35);
        const cx = mx;
        const cy = my - lift;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * cx + t * t * end.x;
          const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * cy + t * t * end.y;
          pts.push({ x, y });
        }
        return pts;
      }

      if (useWrap) {
        const goingRight = pA.x > pB.x;
        const edgeX = goingRight ? w - 20 : 20;
        const otherEdgeX = goingRight ? 20 : w - 20;
        const tEdge = (edgeX - pA.x) / (pB.x + (goingRight ? (w - 40) : -(w - 40)) - pA.x);
        const yAtEdge = pA.y + (pB.y - pA.y) * Math.max(0, Math.min(1, tEdge));
        const exit = { x: edgeX, y: yAtEdge };
        const enter = { x: otherEdgeX, y: yAtEdge };
        const p1 = build(pA, exit, Math.floor(segs/2));
        const p2 = build(enter, pB, Math.floor(segs/2));
        return [p1, p2];
      }
      return [build(pA, pB)];
    }

    function draw(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tRef.current += dt;

      const { sessions, origin, filteredIds, accent, secondary, showGraticule, dotDensity, arcStyle, hoveredId, selectedId } = propsRef.current;
      const primaryRGBA   = pickColorFM(accent);
      const secondaryRGBA = pickColorFM(secondary);

      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(6, 12, 28, 0.6)");
      bg.addColorStop(1, "rgba(2, 4, 12, 0.7)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // graticule
      if (showGraticule) {
        ctx.strokeStyle = primaryRGBA + "0.05)";
        ctx.lineWidth = 1;
        for (let lng = -180; lng <= 180; lng += 30) {
          const { x } = project2D(0, lng, w, h);
          ctx.beginPath();
          ctx.moveTo(x, 20); ctx.lineTo(x, h - 20);
          ctx.stroke();
        }
        for (let lat = -60; lat <= 60; lat += 30) {
          const { y } = project2D(lat, 0, w, h);
          ctx.beginPath();
          ctx.moveTo(20, y); ctx.lineTo(w - 20, y);
          ctx.stroke();
        }
        const eq = project2D(0, 0, w, h);
        ctx.strokeStyle = primaryRGBA + "0.1)";
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(20, eq.y); ctx.lineTo(w - 20, eq.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // dots
      const ds = window.WorldDots.getDots(dotDensity);
      for (let i = 0; i < ds.length; i++) {
        const [lng, lat] = ds[i];
        const { x, y } = project2D(lat, lng, w, h);
        ctx.fillStyle = primaryRGBA + "0.55)";
        ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }

      // arcs
      sessions.forEach((s) => {
        const filtered   = filteredIds ? !filteredIds.has(s.id) : false;
        const isHover    = hoveredId === s.id;
        const isSelected = selectedId === s.id;
        const alpha      = filtered ? 0.12 : (isHover || isSelected ? 1 : 0.85);
        const color      = s.status === "idle" ? secondaryRGBA : primaryRGBA;

        const segments = bezierArc(origin, s, w, h);

        segments.forEach((pts) => {
          if (arcStyle === "glow" || arcStyle === "beam") {
            ctx.strokeStyle = color + (alpha * 0.15).toFixed(3) + ")";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
          }
          ctx.strokeStyle = color + alpha.toFixed(3) + ")";
          ctx.lineWidth = isHover || isSelected ? 1.6 : 1;
          if (arcStyle === "dotted") ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // pulse
        if (!filtered) {
          const totalLen = segments.reduce((acc, seg) => acc + seg.length, 0);
          const phase = (tRef.current * 0.45 + (parseInt(s.id.replace(/\D/g,""),10) * 0.13)) % 1;
          let targetIdx = Math.floor(phase * (totalLen - 1));
          let pt = null;
          for (const seg of segments) {
            if (targetIdx < seg.length) { pt = seg[targetIdx]; break; }
            targetIdx -= seg.length;
          }
          if (pt) {
            const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 12);
            glow.addColorStop(0, color + "0.9)");
            glow.addColorStop(1, color + "0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // endpoint
        const ep = project2D(s.lat, s.lng, w, h);
        const pulseT = (tRef.current * 1.2 + s.id.charCodeAt(2)) % 1;
        ctx.strokeStyle = color + (0.7 * (1 - pulseT) * (filtered ? 0.2 : 1)).toFixed(3) + ")";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 3 + pulseT * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color + (filtered ? 0.3 : 1) + ")";
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, isHover || isSelected ? 4 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        if (isHover || isSelected) {
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        s._screenFlat = { x: ep.x, y: ep.y };
      });

      // origin
      const op = project2D(origin.lat, origin.lng, w, h);
      const ringT = (tRef.current * 0.8) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - ringT) * 0.7})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(op.x, op.y, 4 + ringT * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.beginPath();
      ctx.arc(op.x, op.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(op.x - 8, op.y); ctx.lineTo(op.x - 4, op.y);
      ctx.moveTo(op.x + 4, op.y); ctx.lineTo(op.x + 8, op.y);
      ctx.moveTo(op.x, op.y - 8); ctx.lineTo(op.x, op.y - 4);
      ctx.moveTo(op.x, op.y + 4); ctx.lineTo(op.x, op.y + 8);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function onMove(e) {
      const { sessions, onHover } = propsRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hovered = null;
      for (const s of sessions) {
        if (s._screenFlat) {
          const d = Math.hypot(mx - s._screenFlat.x, my - s._screenFlat.y);
          if (d < 10) { hovered = s.id; break; }
        }
      }
      onHover && onHover(hovered);
    }
    function onClick(e) {
      const { sessions, onSelect } = propsRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const s of sessions) {
        if (s._screenFlat) {
          const d = Math.hypot(mx - s._screenFlat.x, my - s._screenFlat.y);
          if (d < 10) { onSelect && onSelect(s.id); return; }
        }
      }
    }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, []); // Canvas setup runs once; live data flows through propsRef.

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

window.FlatMap = FlatMap;
