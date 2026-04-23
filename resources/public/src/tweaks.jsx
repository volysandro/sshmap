/* global React */
const { useState: useStateT, useEffect: useEffectT } = React;

function TweaksPanel({ tweaks, setTweaks, onClose }) {
  const row = (label, control) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
      {control}
    </div>
  );

  const segButton = (k, v, options) => (
    <div style={{ display: "flex", gap: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => setTweaks({ ...tweaks, [k]: o.value })}
          style={{
            padding: "4px 8px", border: "1px solid " + (v === o.value ? "rgba(120,230,255,0.55)" : "rgba(120,200,255,0.12)"),
            background: v === o.value ? "rgba(120,230,255,0.12)" : "transparent",
            color: v === o.value ? "var(--ink)" : "var(--ink-dim)",
            fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em",
            textTransform: "uppercase", borderRadius: 3, cursor: "pointer",
          }}
        >{o.label}</button>
      ))}
    </div>
  );

  const toggle = (k, v) => (
    <button onClick={() => setTweaks({ ...tweaks, [k]: !v })}
      style={{
        width: 36, height: 18, borderRadius: 10,
        background: v ? "rgba(120,230,255,0.4)" : "rgba(120,200,255,0.08)",
        border: "1px solid " + (v ? "rgba(120,230,255,0.6)" : "rgba(120,200,255,0.15)"),
        position: "relative", cursor: "pointer", padding: 0,
      }}>
      <span style={{
        position: "absolute", top: 1, left: v ? 19 : 1,
        width: 14, height: 14, borderRadius: "50%",
        background: v ? "var(--ink)" : "var(--ink-dim)",
        transition: "left 0.15s",
      }}/>
    </button>
  );

  const slider = (k, v, min, max, step) => (
    <input type="range" min={min} max={max} step={step} value={v}
      onChange={e => setTweaks({ ...tweaks, [k]: parseFloat(e.target.value) })}
      style={{ width: 110, accentColor: "oklch(0.85 0.15 210)" }}
    />
  );

  return (
    <div style={{
      position: "absolute", right: 16, bottom: 16, width: 300, zIndex: 20,
      background: "linear-gradient(180deg, rgba(10,20,40,0.88), rgba(6,12,28,0.88))",
      border: "1px solid rgba(120,200,255,0.22)",
      borderRadius: 6, padding: 14,
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, borderBottom: "1px solid rgba(120,200,255,0.12)", paddingBottom: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--cyan)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Tweaks</span>
        {onClose && <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13 }}>×</button>}
      </div>

      {row("accent", segButton("accent", tweaks.accent, [
        { value: "cyan", label: "cyan" },
        { value: "green", label: "grn" },
        { value: "amber", label: "amb" },
        { value: "white", label: "wht" },
      ]))}
      {row("idle color", segButton("secondary", tweaks.secondary, [
        { value: "magenta", label: "mag" },
        { value: "amber", label: "amb" },
        { value: "red", label: "red" },
      ]))}
      {row("arc style", segButton("arcStyle", tweaks.arcStyle, [
        { value: "glow", label: "glow" },
        { value: "beam", label: "beam" },
        { value: "dotted", label: "dot" },
      ]))}
      {row("dots", segButton("dotDensity", tweaks.dotDensity, [
        { value: "sparse", label: "lo" },
        { value: "medium", label: "md" },
        { value: "dense", label: "hi" },
      ]))}
      {row("auto-rotate", toggle("autoRotate", tweaks.autoRotate))}
      {row("rot speed", slider("rotateSpeed", tweaks.rotateSpeed, 0, 0.3, 0.01))}
      {row("graticule", toggle("showGraticule", tweaks.showGraticule))}
      {row("simulate", toggle("simulating", tweaks.simulating))}
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
