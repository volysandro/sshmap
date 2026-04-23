/* global React, ReactDOM */
const { useState, useEffect, useMemo } = React;

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "cyan",
  "secondary": "magenta",
  "arcStyle": "glow",
  "dotDensity": "medium",
  "autoRotate": true,
  "rotateSpeed": 0.08,
  "showGraticule": true,
  "simulating": false
}/*EDITMODE-END*/;

// Inject keyframes for blinking
const styleEl = document.createElement("style");
styleEl.textContent = `
  @keyframes blink { 0%, 70% { opacity: 1; } 85% { opacity: 0.3; } 100% { opacity: 1; } }
  @keyframes scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
  input[type=range] { height: 14px; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(120,200,255,0.2); border-radius: 3px; }
`;
document.head.appendChild(styleEl);

function App() {
  const { ORIGIN: initialOrigin, SESSIONS } = window.SessionData;

  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("sshmap.view") || "globe"; } catch { return "globe"; }
  });
  useEffect(() => {
    try { localStorage.setItem("sshmap.view", viewMode); } catch {}
  }, [viewMode]);

  const [origin, setOrigin] = useState(initialOrigin);
  const [sessions, setSessions] = useState(SESSIONS);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Live backend connection via WebSocket
  useEffect(() => {
    let ws, reconnectTimer;
    function connect() {
      ws = new WebSocket(`ws://${window.location.host}/ws`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            if (msg.origin)   setOrigin(msg.origin);
            if (msg.sessions) setSessions(msg.sessions);
          } else if (msg.type === "sessions") {
            setSessions(msg.sessions);
          }
        } catch (_) {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
    }
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // filtered ids for map
  const filteredIds = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    const out = new Set();
    sessions.forEach(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return;
      if (q) {
        const matches = (
          s.host.toLowerCase().includes(q) ||
          s.ip.toLowerCase().includes(q) ||
          s.user.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q)
        );
        if (!matches) return;
      }
      out.add(s.id);
    });
    return out;
  }, [sessions, filterText, statusFilter]);

  // Simulation: occasionally bump bytes and flip one to idle/active
  useEffect(() => {
    if (!tweaks.simulating) return;
    const t = setInterval(() => {
      setSessions(prev => prev.map(s => ({
        ...s,
        bytesIn: s.bytesIn + Math.floor(Math.random() * 500000),
        bytesOut: s.bytesOut + Math.floor(Math.random() * 80000),
        status: Math.random() < 0.04 ? (s.status === "active" ? "idle" : "active") : s.status,
      })));
    }, 1500);
    return () => clearInterval(t);
  }, [tweaks.simulating]);

  // Edit-mode protocol
  useEffect(() => {
    function onMsg(e) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const updateTweaks = (next) => {
    setTweaks(next);
    const diff = {};
    for (const k of Object.keys(next)) if (next[k] !== tweaks[k]) diff[k] = next[k];
    if (Object.keys(diff).length) {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: diff }, "*");
    }
  };

  const selected = sessions.find(s => s.id === selectedId) || null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Map */}
      <div style={{ position: "absolute", inset: 0 }} data-screen-label="01 SSH Map">
        {viewMode === "globe" ? (
          <window.Globe
            dots={null}
            origin={origin}
            sessions={sessions}
            filteredIds={filteredIds}
            accent={tweaks.accent}
            secondary={tweaks.secondary}
            autoRotate={tweaks.autoRotate}
            rotateSpeed={tweaks.rotateSpeed}
            showGraticule={tweaks.showGraticule}
            dotDensity={tweaks.dotDensity}
            arcStyle={tweaks.arcStyle}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ) : (
          <window.FlatMap
            origin={origin}
            sessions={sessions}
            filteredIds={filteredIds}
            accent={tweaks.accent}
            secondary={tweaks.secondary}
            showGraticule={tweaks.showGraticule}
            dotDensity={tweaks.dotDensity}
            arcStyle={tweaks.arcStyle}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        )}
      </div>

      {/* Header */}
      <window.HeaderBar
        sessions={sessions}
        origin={origin}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Sessions */}
      <window.SessionsPanel
        sessions={sessions}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        filterText={filterText}
        setFilterText={setFilterText}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Details */}
      <window.DetailsPanel session={selected} onClose={() => setSelectedId(null)} />

      {/* Corner HUD tick marks */}
      <CornerTicks/>

      {/* Tweaks */}
      {tweaksOpen && (
        <window.TweaksPanel tweaks={tweaks} setTweaks={updateTweaks} onClose={() => setTweaksOpen(false)}/>
      )}
    </div>
  );
}

function CornerTicks() {
  const tickColor = "rgba(120,200,255,0.35)";
  const tick = (s) => ({
    position: "absolute", width: 14, height: 14,
    borderColor: tickColor, ...s,
  });
  return (
    <div style={{ position: "absolute", inset: 8, pointerEvents: "none", zIndex: 5 }}>
      <div style={tick({ top: 0, left: 0, borderLeft: "1px solid", borderTop: "1px solid" })}/>
      <div style={tick({ top: 0, right: 0, borderRight: "1px solid", borderTop: "1px solid" })}/>
      <div style={tick({ bottom: 0, left: 0, borderLeft: "1px solid", borderBottom: "1px solid" })}/>
      <div style={tick({ bottom: 0, right: 0, borderRight: "1px solid", borderBottom: "1px solid" })}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
