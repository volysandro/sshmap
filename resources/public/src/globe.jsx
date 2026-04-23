/* global React */
// Orthographic rotating globe + arcs.

const { useRef, useEffect } = React;

function latLngToXYZ(lat, lng) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

function rotateY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotateX([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

function project(p3, cx, cy, r) {
  return { x: cx + p3[0] * r, y: cy - p3[1] * r, z: p3[2] };
}

function greatCircleArc(a, b, segments = 48) {
  const A = latLngToXYZ(a.lat, a.lng);
  const B = latLngToXYZ(b.lat, b.lng);
  const dot = A[0]*B[0] + A[1]*B[1] + A[2]*B[2];
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinO = Math.sin(omega) || 1e-6;
  const pts = [];
  const maxLift = 0.35;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const s1 = Math.sin((1 - t) * omega) / sinO;
    const s2 = Math.sin(t * omega) / sinO;
    let x = s1 * A[0] + s2 * B[0];
    let y = s1 * A[1] + s2 * B[1];
    let z = s1 * A[2] + s2 * B[2];
    const len = Math.hypot(x, y, z) || 1;
    const lift = 1 + maxLift * Math.sin(t * Math.PI);
    x = x / len * lift; y = y / len * lift; z = z / len * lift;
    pts.push([x, y, z]);
  }
  return pts;
}

function pickColor(name) {
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

function Globe({
  dots, origin, sessions, filteredIds,
  accent = "cyan", secondary = "magenta",
  autoRotate = true, rotateSpeed = 0.05,
  showGraticule = true,
  dotDensity = "medium",
  arcStyle = "glow",
  hoveredId, onHover, onSelect,
  selectedId,
}) {
  const canvasRef    = useRef(null);
  const rotRef       = useRef({ yaw: 2.2, pitch: -0.35, dragging: false });
  const lastMouseRef = useRef(null);
  const tRef         = useRef(0);
  const sizeRef      = useRef({ w: 0, h: 0, dpr: 1 });

  // All props land here on every render; the animation loop reads from this ref
  // so live data updates never restart the canvas effect.
  const propsRef = useRef({});
  propsRef.current = { sessions, origin, filteredIds, accent, secondary, autoRotate, rotateSpeed, showGraticule, dotDensity, arcStyle, hoveredId, selectedId, onHover, onSelect };

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

    function draw(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tRef.current += dt;

      const { sessions, origin, filteredIds, accent, secondary, autoRotate, rotateSpeed, showGraticule, dotDensity, arcStyle, hoveredId, selectedId } = propsRef.current;
      const primaryRGBA   = pickColor(accent);
      const secondaryRGBA = pickColor(secondary);

      if (autoRotate && !rotRef.current.dragging) {
        rotRef.current.yaw += rotateSpeed * dt;
      }

      const { w, h } = sizeRef.current;
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);

      // outer glow halo
      const halo = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.35);
      halo.addColorStop(0, primaryRGBA + "0.22)");
      halo.addColorStop(0.5, primaryRGBA + "0.06)");
      halo.addColorStop(1, primaryRGBA + "0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // sphere body
      const body = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, "rgba(18, 30, 58, 1)");
      body.addColorStop(0.7, "rgba(8, 14, 30, 1)");
      body.addColorStop(1, "rgba(3, 6, 16, 1)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // graticule
      if (showGraticule) {
        ctx.strokeStyle = primaryRGBA + "0.06)";
        ctx.lineWidth = 1;
        for (let lng = -180; lng < 180; lng += 20) {
          ctx.beginPath();
          let moved = false;
          for (let lat = -80; lat <= 80; lat += 4) {
            let p = latLngToXYZ(lat, lng);
            p = rotateY(p, rotRef.current.yaw);
            p = rotateX(p, rotRef.current.pitch);
            if (p[2] < -0.02) { moved = false; continue; }
            const pr = project(p, cx, cy, r);
            if (!moved) { ctx.moveTo(pr.x, pr.y); moved = true; }
            else ctx.lineTo(pr.x, pr.y);
          }
          ctx.stroke();
        }
        for (let lat = -60; lat <= 60; lat += 20) {
          ctx.beginPath();
          let moved = false;
          for (let lng = -180; lng <= 180; lng += 4) {
            let p = latLngToXYZ(lat, lng);
            p = rotateY(p, rotRef.current.yaw);
            p = rotateX(p, rotRef.current.pitch);
            if (p[2] < -0.02) { moved = false; continue; }
            const pr = project(p, cx, cy, r);
            if (!moved) { ctx.moveTo(pr.x, pr.y); moved = true; }
            else ctx.lineTo(pr.x, pr.y);
          }
          ctx.stroke();
        }
      }

      // continent dots
      const ds = window.WorldDots.getDots(dotDensity);
      for (let i = 0; i < ds.length; i++) {
        const [lng, lat] = ds[i];
        let p = latLngToXYZ(lat, lng);
        p = rotateY(p, rotRef.current.yaw);
        p = rotateX(p, rotRef.current.pitch);
        if (p[2] < 0) continue;
        const pr = project(p, cx, cy, r);
        const a = 0.35 + p[2] * 0.55;
        const sz = 1 + p[2] * 1.1;
        ctx.fillStyle = primaryRGBA + a.toFixed(3) + ")";
        ctx.fillRect(pr.x - sz / 2, pr.y - sz / 2, sz, sz);
      }

      // arcs + endpoints
      const yaw = rotRef.current.yaw, pitch = rotRef.current.pitch;

      let originP3 = latLngToXYZ(origin.lat, origin.lng);
      originP3 = rotateY(originP3, yaw);
      originP3 = rotateX(originP3, pitch);
      const originVisible = originP3[2] > -0.05;
      const originPr = project(originP3, cx, cy, r);

      sessions.forEach((s) => {
        const filtered   = filteredIds ? !filteredIds.has(s.id) : false;
        const isHover    = hoveredId === s.id;
        const isSelected = selectedId === s.id;
        const alpha      = filtered ? 0.12 : (isHover || isSelected ? 1 : 0.9);
        const color      = s.status === "idle" ? secondaryRGBA : primaryRGBA;

        const arc3 = greatCircleArc(origin, s, 64);
        const projPts = arc3.map(p => {
          let q = rotateY(p, yaw);
          q = rotateX(q, pitch);
          return { ...project(q, cx, cy, r), z: q[2] };
        });

        ctx.lineCap = "round";
        if (arcStyle === "glow" || arcStyle === "beam") {
          ctx.strokeStyle = color + (alpha * 0.15).toFixed(3) + ")";
          ctx.lineWidth = 6;
          ctx.beginPath();
          let moved = false;
          for (let i = 0; i < projPts.length; i++) {
            const pt = projPts[i];
            if (pt.z < -0.25) { moved = false; continue; }
            if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = color + alpha.toFixed(3) + ")";
        ctx.lineWidth = isHover || isSelected ? 1.6 : 1;
        if (arcStyle === "dotted") ctx.setLineDash([2, 4]);
        ctx.beginPath();
        let moved = false;
        for (let i = 0; i < projPts.length; i++) {
          const pt = projPts[i];
          if (pt.z < -0.25) { moved = false; continue; }
          if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // traveling pulse
        if (!filtered) {
          const phase = (tRef.current * 0.45 + (parseInt(s.id.replace(/\D/g,""),10) * 0.13)) % 1;
          const idx = Math.floor(phase * (projPts.length - 1));
          const pt = projPts[idx];
          if (pt && pt.z > -0.25) {
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

        // endpoint dot
        let ep = latLngToXYZ(s.lat, s.lng);
        ep = rotateY(ep, yaw);
        ep = rotateX(ep, pitch);
        if (ep[2] > -0.05) {
          const pr = project(ep, cx, cy, r);
          const pulseT = (tRef.current * 1.2 + s.id.charCodeAt(2)) % 1;
          const pr1 = 3 + pulseT * 14;
          ctx.strokeStyle = color + (0.7 * (1 - pulseT) * (filtered ? 0.2 : 1)).toFixed(3) + ")";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, pr1, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = color + (filtered ? 0.3 : 1) + ")";
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, isHover || isSelected ? 4 : 2.6, 0, Math.PI * 2);
          ctx.fill();
          if (isHover || isSelected) {
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, 7, 0, Math.PI * 2);
            ctx.stroke();
          }
          s._screen = { x: pr.x, y: pr.y, visible: true };
        } else {
          s._screen = { x: 0, y: 0, visible: false };
        }
      });

      // origin marker
      if (originVisible) {
        const ringT = (tRef.current * 0.8) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - ringT) * 0.7})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(originPr.x, originPr.y, 4 + ringT * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.arc(originPr.x, originPr.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originPr.x - 8, originPr.y); ctx.lineTo(originPr.x - 4, originPr.y);
        ctx.moveTo(originPr.x + 4, originPr.y); ctx.lineTo(originPr.x + 8, originPr.y);
        ctx.moveTo(originPr.x, originPr.y - 8); ctx.lineTo(originPr.x, originPr.y - 4);
        ctx.moveTo(originPr.x, originPr.y + 4); ctx.lineTo(originPr.x, originPr.y + 8);
        ctx.stroke();
      }

      ctx.restore();

      // rim
      ctx.strokeStyle = primaryRGBA + "0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function onDown(e) {
      rotRef.current.dragging = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
    function onMove(e) {
      const { sessions, onHover } = propsRef.current;
      let hovered = null;
      for (const s of sessions) {
        if (s._screen && s._screen.visible) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const d = Math.hypot(mx - s._screen.x, my - s._screen.y);
          if (d < 10) { hovered = s.id; break; }
        }
      }
      onHover && onHover(hovered);

      if (!rotRef.current.dragging) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      rotRef.current.yaw += dx * 0.005;
      rotRef.current.pitch = Math.max(-1.2, Math.min(1.2, rotRef.current.pitch + dy * 0.005));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
    function onUp() { rotRef.current.dragging = false; }
    function onClick(e) {
      const { sessions, onSelect } = propsRef.current;
      for (const s of sessions) {
        if (s._screen && s._screen.visible) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const d = Math.hypot(mx - s._screen.x, my - s._screen.y);
          if (d < 10) { onSelect && onSelect(s.id); return; }
        }
      }
    }
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("click", onClick);
    };
  }, []); // Canvas setup runs once; live data flows through propsRef.

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />
    </div>
  );
}

window.Globe = Globe;
