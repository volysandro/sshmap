/* global React */
// Side panels: stats header, session list with filter/search, details pane.

const { useMemo: useMemoP, useState: useStateP } = React;

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2,"0")}s`;
  return `${sec}s`;
}

const panelStyle = {
  background: "linear-gradient(180deg, rgba(10,20,40,0.82), rgba(6,12,28,0.82))",
  border: "1px solid rgba(120,200,255,0.18)",
  borderRadius: 6,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 40px rgba(60,160,255,0.06) inset",
};

function StatusPill({ status }) {
  const color = status === "active" ? "oklch(0.82 0.18 155)" : "oklch(0.82 0.16 75)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase",
      color, letterSpacing: "0.1em",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 999, background: color,
        boxShadow: `0 0 8px ${color}`,
        animation: status === "active" ? "blink 1.2s infinite" : "none",
      }}/>
      {status}
    </span>
  );
}

function HeaderBar({ sessions, origin, viewMode, setViewMode, simulating, setSimulating }) {
  const activeCount = sessions.filter(s => s.status === "active").length;
  const totalIn = sessions.reduce((a, s) => a + s.bytesIn, 0);
  const totalOut = sessions.reduce((a, s) => a + s.bytesOut, 0);
  const longest = sessions.reduce((a, s) => Math.min(a, s.startedAt), Infinity);
  const longestMs = Date.now() - longest;

  const stat = (label, value, accent) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 80 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--ink-dim)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: accent || "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: "absolute", top: 16, left: 16, right: 16, zIndex: 10,
      display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 16,
      pointerEvents: "none",
    }}>
      {/* Left: brand + origin */}
      <div style={{ ...panelStyle, padding: "10px 16px", display: "flex", alignItems: "center", gap: 16, pointerEvents: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--cyan)", textTransform: "uppercase" }}>sshmap</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-dim)", letterSpacing: "0.1em" }}>active connection map · v0.1</span>
        </div>
        <div style={{ width: 1, height: 26, background: "rgba(120,200,255,0.18)" }}/>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>origin</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>
            ◉ {origin.label} <span style={{ color: "var(--ink-dim)" }}>· {origin.city}</span>
          </span>
        </div>
      </div>

      {/* Middle: stats */}
      <div style={{ ...panelStyle, padding: "10px 20px", display: "flex", alignItems: "center", gap: 28, flex: 1, justifyContent: "center", pointerEvents: "auto" }}>
        {stat("sessions", sessions.length, "var(--cyan)")}
        {stat("active", activeCount, "oklch(0.82 0.18 155)")}
        {stat("↓ ingress", formatBytes(totalIn))}
        {stat("↑ egress", formatBytes(totalOut))}
        {stat("longest", formatDuration(longestMs))}
      </div>

      {/* Right: view toggle */}
      <div style={{ ...panelStyle, padding: 4, display: "flex", gap: 2, pointerEvents: "auto" }}>
        {[
          { k: "globe", label: "GLOBE" },
          { k: "flat", label: "FLAT" },
        ].map(v => (
          <button key={v.k} onClick={() => setViewMode(v.k)}
            style={{
              background: viewMode === v.k ? "var(--cyan-soft)" : "transparent",
              border: "1px solid " + (viewMode === v.k ? "rgba(120,230,255,0.6)" : "transparent"),
              color: viewMode === v.k ? "var(--ink)" : "var(--ink-dim)",
              fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.15em",
              padding: "8px 14px", cursor: "pointer", borderRadius: 4,
              textShadow: viewMode === v.k ? "0 0 8px rgba(120,230,255,0.7)" : "none",
            }}
          >{v.label}</button>
        ))}
      </div>
    </div>
  );
}

function SessionsPanel({ sessions, hoveredId, setHoveredId, selectedId, setSelectedId, filterText, setFilterText, statusFilter, setStatusFilter }) {
  const filtered = useMemoP(() => {
    const q = filterText.toLowerCase().trim();
    return sessions.filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.host.toLowerCase().includes(q) ||
        s.ip.toLowerCase().includes(q) ||
        s.user.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
      );
    });
  }, [sessions, filterText, statusFilter]);

  return (
    <div style={{
      ...panelStyle,
      position: "absolute", left: 16, top: 92, bottom: 16, width: 340, zIndex: 10,
      display: "flex", flexDirection: "column",
    }}>
      {/* Filter */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(120,200,255,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.15em" }}>#</span>
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="filter host, ip, user, region…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 12,
              caretColor: "var(--cyan)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {["all", "active", "idle"].map(k => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              flex: 1, padding: "4px 6px", border: "1px solid " + (statusFilter === k ? "rgba(120,230,255,0.5)" : "rgba(120,200,255,0.12)"),
              background: statusFilter === k ? "var(--cyan-soft)" : "transparent",
              color: statusFilter === k ? "var(--ink)" : "var(--ink-dim)",
              fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em",
              textTransform: "uppercase", borderRadius: 3, cursor: "pointer",
            }}>{k}</button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(120,200,255,0.12)", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          {filtered.length} / {sessions.length} sessions
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cyan)", letterSpacing: "0.15em" }}>●  live</span>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.map(s => {
          const hovered = hoveredId === s.id;
          const selected = selectedId === s.id;
          const dur = formatDuration(Date.now() - s.startedAt);
          return (
            <div key={s.id}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedId(selected ? null : s.id)}
              style={{
                padding: "10px 14px", cursor: "pointer",
                borderBottom: "1px solid rgba(120,200,255,0.06)",
                background: selected ? "rgba(120,230,255,0.08)" : hovered ? "rgba(120,230,255,0.04)" : "transparent",
                borderLeft: "2px solid " + (selected ? "var(--cyan)" : "transparent"),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
                  {s.user}<span style={{ color: "var(--ink-dim)" }}>@</span>{s.host}
                </span>
                <StatusPill status={s.status}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)" }}>
                  {s.city}, {s.country} · {s.region}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)" }}>
                  {dur}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)" }}>{s.ip}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)" }}>
                  ↓{formatBytes(s.bytesIn)} ↑{formatBytes(s.bytesOut)}
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 20, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", textAlign: "center" }}>
            no matches
          </div>
        )}
      </div>
    </div>
  );
}

function DetailsPanel({ session, onClose }) {
  if (!session) return null;
  const dur = formatDuration(Date.now() - session.startedAt);
  const row = (k, v, mono = true) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed rgba(120,200,255,0.1)" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ fontFamily: mono ? "var(--mono)" : "var(--sans)", fontSize: 11, color: "var(--ink)" }}>{v}</span>
    </div>
  );
  return (
    <div style={{
      ...panelStyle,
      position: "absolute", right: 16, top: 92, width: 320, zIndex: 12,
      padding: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cyan)", letterSpacing: "0.2em", textTransform: "uppercase" }}>session · {session.id}</span>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)", fontFamily: "var(--mono)", fontSize: 14, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)", marginBottom: 2, fontWeight: 500 }}>
        {session.user}<span style={{ color: "var(--ink-dim)" }}>@</span>{session.host}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-dim)", marginBottom: 12 }}>
        {session.city}, {session.country}
      </div>
      {row("ip", session.ip)}
      {row("region", session.region)}
      {row("lat/lng", session.lat.toFixed(3) + ", " + session.lng.toFixed(3))}
      {row("status", <StatusPill status={session.status}/>)}
      {row("duration", dur)}
      {row("ingress", formatBytes(session.bytesIn))}
      {row("egress", formatBytes(session.bytesOut))}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>current cmd</div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)",
          background: "rgba(0,0,0,0.35)", border: "1px solid rgba(120,200,255,0.1)",
          borderRadius: 3, padding: "8px 10px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          $ {session.cmd}
        </div>
      </div>
    </div>
  );
}

window.HeaderBar = HeaderBar;
window.SessionsPanel = SessionsPanel;
window.DetailsPanel = DetailsPanel;
window.formatBytes = formatBytes;
window.formatDuration = formatDuration;
