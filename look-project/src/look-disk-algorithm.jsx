import { useState, useEffect, useRef, useCallback } from "react";
import {
  computeLOOK,
  computeFCFS,
  computeSSTF,
  computeSCAN,
  computeCSCAN,
  computeCLOOK,
} from "./algorithms";

const DISK_MAX = 199;
const TRACK_WIDTH = 680;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function trackToX(track) {
  return 48 + ((track / DISK_MAX) * (TRACK_WIDTH - 96));
}

const PRESETS = [
  { label: "Classic", queue: [98, 183, 37, 122, 14, 124, 65, 67], head: 53, dir: "right" },
  { label: "Dense", queue: [10, 22, 55, 70, 88, 100, 130, 150, 170, 190], head: 50, dir: "right" },
  { label: "Sparse", queue: [5, 195, 30, 160, 85, 140], head: 100, dir: "left" },
];

export default function App() {
  const [queueInput, setQueueInput] = useState("98, 183, 37, 122, 14, 124, 65, 67");
  const [headInput, setHeadInput] = useState("53");
  const [direction, setDirection] = useState("right");
  const [result, setResult] = useState(null);
  const [animStep, setAnimStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [armX, setArmX] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [error, setError] = useState("");
  const [activePreset, setActivePreset] = useState(0);
  
  // Theme Toggle State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // API Integration States
  const [simulations, setSimulations] = useState([]);
  const [saveTitle, setSaveTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  
  // Live Audit Logs States
  const [dbLogs, setDbLogs] = useState([]);

  const intervalRef = useRef(null);
  const svgRef = useRef(null);
  const animStepRef = useRef(-1);
  animStepRef.current = animStep;

  // DB Logs API Actions
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setDbLogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, []);

  const logAction = useCallback(async (action, details) => {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details }),
      });
      fetchLogs();
    } catch (err) {
      console.error("Error logging action:", err);
    }
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/logs", {
        method: "DELETE"
      });
      if (res.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const runSimulation = useCallback((q, h, d, shouldLog = false) => {
    const parsed = q
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n <= DISK_MAX);

    if (parsed.length === 0) {
      setError("Enter valid track numbers (0–199).");
      return;
    }
    const headVal = parseInt(h);
    if (isNaN(headVal) || headVal < 0 || headVal > DISK_MAX) {
      setError("Head position must be 0–199.");
      return;
    }
    setError("");

    // Calculate LOOK
    const res = computeLOOK(parsed, headVal, d);

    // Calculate comparisons
    const fcfs = computeFCFS(parsed, headVal);
    const sstf = computeSSTF(parsed, headVal);
    const scan = computeSCAN(parsed, headVal, d);
    const cscan = computeCSCAN(parsed, headVal, d);
    const clook = computeCLOOK(parsed, headVal, d);

    setComparisonResults({
      fcfs: fcfs.totalSeek,
      sstf: sstf.totalSeek,
      scan: scan.totalSeek,
      cscan: cscan.totalSeek,
      clook: clook.totalSeek,
      look: res.totalSeek
    });

    setResult(res);
    setAnimStep(-1);
    setIsPlaying(false);
    setPathPoints([]);
    setArmX(trackToX(headVal));
    clearInterval(intervalRef.current);

    if (shouldLog) {
      logAction("SIMULATION_RUN", `Queue: [${parsed.join(", ")}], Head: ${headVal}, Dir: ${d}`);
    }
  }, [logAction]);

  // API Methods
  const fetchSimulations = useCallback(async () => {
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json();
        setSimulations(data);
      }
    } catch (err) {
      console.error("Error fetching simulations:", err);
    }
  }, []);

  const handleSaveSimulation = async () => {
    if (!result || !comparisonResults) return;
    const title = saveTitle.trim() || `Run: ${result.sequence.length - 1} reqs (${direction})`;
    setIsSaving(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          queue: result.order,
          head: parseInt(headInput),
          direction,
          lookResult: result,
          comparison: {
            fcfsSeek: comparisonResults.fcfs,
            sstfSeek: comparisonResults.sstf,
            scanSeek: comparisonResults.scan,
            cscanSeek: comparisonResults.cscan,
            clookSeek: comparisonResults.clook
          }
        })
      });
      if (res.ok) {
        setSaveTitle("");
        setShowSaveInput(false);
        fetchSimulations();
        logAction("SIMULATION_SAVE", `Saved simulation config: "${title}"`);
      }
    } catch (err) {
      console.error("Error saving simulation:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSimulation = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/simulations/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchSimulations();
        logAction("SIMULATION_DELETE", `Deleted simulation record ID: ${id}`);
      }
    } catch (err) {
      console.error("Error deleting simulation:", err);
    }
  };

  const handleLoadSimulation = (sim) => {
    setQueueInput(sim.queue.join(", "));
    setHeadInput(String(sim.head));
    setDirection(sim.direction);
    runSimulation(sim.queue.join(", "), String(sim.head), sim.direction, false);
    logAction("SIMULATION_LOAD", `Loaded simulation: "${sim.title}" from MongoDB`);
  };

  // Per-card dispatch input state: { [simId]: trackValueString }
  const [dispatchInputs, setDispatchInputs] = useState({});
  const [dispatchingId, setDispatchingId] = useState(null);

  const handleDispatchTrack = async (sim, e) => {
    e.stopPropagation();
    const trackStr = (dispatchInputs[sim._id] || "").trim();
    const trackNum = parseInt(trackStr);
    if (isNaN(trackNum) || trackNum < 0 || trackNum > 199) return;
    setDispatchingId(sim._id);
    try {
      const res = await fetch(`/api/simulations/${sim._id}/dispatch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: trackNum }),
      });
      if (res.ok) {
        setDispatchInputs((prev) => ({ ...prev, [sim._id]: "" }));
        fetchSimulations();
        logAction(
          "TRACK_DISPATCH",
          `Dispatched track ${trackNum} → "${sim.title}" | Backend recalculated all 6 algorithms & wrote to MongoDB`
        );
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    } finally {
      setDispatchingId(null);
    }
  };

  useEffect(() => {
    runSimulation(queueInput, headInput, direction, false);
    fetchSimulations();
    fetchLogs();
  }, [runSimulation, fetchSimulations, fetchLogs]);

  useEffect(() => {
    if (!isPlaying || !result) return;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const cur = animStepRef.current;
      if (cur >= result.sequence.length - 2) {
        setIsPlaying(false);
        clearInterval(intervalRef.current);
        return;
      }
      const next = cur + 1;
      setAnimStep(next);
      const fromTrack = result.sequence[next];
      setArmX(trackToX(fromTrack));
      setPathPoints((pts) => {
        const x = trackToX(fromTrack);
        return [...pts, { track: fromTrack, x, step: next }];
      });
    }, Math.max(200, 900 / speed));

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, result, speed]);

  const handlePlay = () => {
    if (!result) return;
    if (animStep >= result.sequence.length - 2) {
      handleReset();
      setTimeout(() => setIsPlaying(true), 50);
      return;
    }
    setIsPlaying((p) => !p);
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    setAnimStep(-1);
    setPathPoints([]);
    if (result) setArmX(trackToX(result.sequence[0]));
  };

  const handleStep = () => {
    if (!result) return;
    clearInterval(intervalRef.current);
    setIsPlaying(false);
    const cur = animStepRef.current;
    if (cur >= result.sequence.length - 2) return;
    const next = cur + 1;
    setAnimStep(next);
    const fromTrack = result.sequence[next];
    setArmX(trackToX(fromTrack));
    setPathPoints((pts) => {
      const x = trackToX(fromTrack);
      return [...pts, { track: fromTrack, x, step: next }];
    });
  };

  const applyPreset = (i) => {
    const p = PRESETS[i];
    setActivePreset(i);
    setQueueInput(p.queue.join(", "));
    setHeadInput(String(p.head));
    setDirection(p.dir);
    runSimulation(p.queue.join(", "), String(p.head), p.dir, false);
    logAction("PRESET_LOAD", `Loaded Preset "${p.label}"`);
  };

  const handleSubmit = () => runSimulation(queueInput, headInput, direction, true);

  const svgH = 220;
  const armVisualX = armX ?? (result ? trackToX(result.sequence[0]) : trackToX(53));

  const seqDisplayUntil = animStep === -1 ? 0 : animStep + 1;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--white)",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      transition: "background 0.3s, color 0.3s",
    }}>
      {/* Google Fonts & CSS Theme variables overrides */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --white: ${isDarkMode ? "#f0f0f0" : "#111111"};
          --dim: ${isDarkMode ? "#999999" : "#555555"};
          --dimmer: ${isDarkMode ? "#555555" : "#999999"};
          --border: ${isDarkMode ? "#222222" : "#e5e5e5"};
          --bg: ${isDarkMode ? "#0a0a0a" : "#fdfdfd"};
          --surface: ${isDarkMode ? "#111111" : "#f5f5f5"};
          --accent: ${isDarkMode ? "#e0e0e0" : "#1e1e1e"};
        }

        body { background: var(--bg); color: var(--white); transition: background 0.3s; }

        .mono { font-family: 'DM Mono', monospace; }
        .serif { font-family: 'Playfair Display', serif; }

        input[type=text], input[type=number] {
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--border);
          color: var(--white);
          font-family: 'DM Mono', monospace;
          font-size: 15px;
          padding: 6px 2px;
          outline: none;
          width: 100%;
          transition: border-color 0.2s, color 0.2s;
          letter-spacing: 0.04em;
        }
        input[type=text]:focus, input[type=number]:focus {
          border-bottom-color: var(--dim);
        }

        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          width: 100%;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-track {
          height: 1px;
          background: var(--dimmer);
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--white);
          margin-top: -4.5px;
          transition: transform 0.15s, background 0.3s;
        }
        input[type=range]:hover::-webkit-slider-thumb {
          transform: scale(1.3);
        }

        .btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--dim);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 8px 20px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover { border-color: var(--dim); color: var(--white); }
        .btn.active { border-color: var(--white); color: var(--white); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn.primary {
          border-color: var(--white);
          color: var(--white);
        }
        .btn.primary:hover { background: var(--white); color: var(--bg); }

        .seg-btn {
          background: transparent;
          border: none;
          color: var(--dimmer);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .seg-btn.active { color: var(--white); }
        .seg-btn.active::after {
          content: '';
          position: absolute;
          bottom: 0; left: 14px; right: 14px;
          height: 1px;
          background: var(--white);
        }

        .tag {
          display: inline-block;
          border: 1px solid var(--border);
          padding: 3px 10px;
          font-size: 13px;
          letter-spacing: 0.08em;
          color: var(--dim);
          transition: all 0.2s;
        }
        .tag.visited {
          border-color: var(--white);
          color: var(--white);
        }
        .tag.current {
          background: var(--white);
          border-color: var(--white);
          color: var(--bg);
        }

        .fade-in {
          animation: fadeIn 0.4s ease both;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .arm-line {
          transition: x 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .scroll-seq {
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .scroll-seq::-webkit-scrollbar { height: 3px; }
        .scroll-seq::-webkit-scrollbar-track { background: transparent; }
        .scroll-seq::-webkit-scrollbar-thumb { background: var(--border); }

        .stat-val {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--white);
        }
        .stat-lbl {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--dimmer);
          margin-top: 4px;
        }

        .divider {
          border: none;
          border-top: 1px solid var(--border);
        }

        /* Responsive Dashboard layout */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          margin-top: 24px;
        }
        @media (min-width: 1100px) {
          .dashboard-grid {
            grid-template-columns: 1.8fr 1.1fr;
          }
        }
        .sidebar-panel {
          border-left: 1px solid var(--border);
          padding-left: 48px;
        }
        @media (max-width: 1099px) {
          .sidebar-panel {
            border-left: none;
            border-top: 1px solid var(--border);
            padding-left: 0;
            padding-top: 48px;
          }
        }
        .history-card {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .history-card:hover {
          border-color: var(--dim);
          background: var(--surface);
          opacity: 0.95;
        }
        .history-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .history-card-title {
          font-size: 15px;
          font-weight: 500;
          color: var(--white);
          letter-spacing: 0.04em;
        }
        .history-card-delete {
          background: transparent;
          border: none;
          color: var(--dimmer);
          cursor: pointer;
          font-size: 13px;
          transition: color 0.15s;
        }
        .history-card-delete:hover {
          color: #ff5555;
        }
        .history-card-meta {
          font-size: 13px;
          color: var(--dimmer);
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }
        .history-card-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .comparison-bar-container {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          gap: 12px;
        }
        .comparison-bar-label {
          width: 70px;
          font-size: 13px;
          color: var(--dim);
          letter-spacing: 0.05em;
        }
        .comparison-bar-track {
          flex: 1;
          height: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          position: relative;
        }
        .comparison-bar-fill {
          height: 100%;
          background: var(--dimmer);
          transition: width 0.4s ease-out;
        }
        .comparison-bar-fill.highlight {
          background: var(--white);
        }
        .comparison-bar-value {
          width: 40px;
          font-size: 13px;
          text-align: right;
          color: var(--white);
          font-weight: 500;
        }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        padding: "48px 48px 32px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 12 }}>
            Disk Scheduling · Algorithm Visualizer
          </div>
          <h1 className="serif" style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--white)" }}>
            LOOK
          </h1>
          <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 10, letterSpacing: "0.06em", maxWidth: 340 }}>
            The disk arm moves toward the outermost request in each direction,
            then reverses — never traveling to the disk edges unnecessarily.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {PRESETS.map((p, i) => (
            <button key={i} className={`btn ${activePreset === i ? "active" : ""}`} onClick={() => applyPreset(i)}>
              {p.label}
            </button>
          ))}
          {/* Theme Toggle Button */}
          <button 
            className="btn" 
            onClick={() => {
              const nextMode = !isDarkMode;
              setIsDarkMode(nextMode);
              logAction("THEME_TOGGLE", `Switched theme to ${nextMode ? "Dark Mode" : "Light Mode"}`);
            }} 
            style={{ 
              marginLeft: 8, 
              display: "flex", 
              alignItems: "center", 
              gap: 6,
              background: "var(--surface)",
              borderColor: "var(--border)"
            }}
          >
            {isDarkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, padding: "0 48px 64px" }}>

        {/* ── CONTROLS ── */}
        <section style={{ paddingTop: 36, paddingBottom: 36, display: "grid", gridTemplateColumns: "1fr 160px auto auto auto", gap: 32, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 8 }}>
              Request Queue
            </div>
            <input
              type="text"
              value={queueInput}
              onChange={(e) => setQueueInput(e.target.value)}
              placeholder="e.g. 98, 183, 37, 122..."
            />
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 8 }}>
              Head Position
            </div>
            <input
              type="number"
              value={headInput}
              min={0} max={DISK_MAX}
              onChange={(e) => setHeadInput(e.target.value)}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 8 }}>
              Direction
            </div>
            <div style={{ display: "flex", border: "1px solid var(--border)" }}>
              <button className={`seg-btn ${direction === "left" ? "active" : ""}`} onClick={() => setDirection("left")}>← Left</button>
              <button className={`seg-btn ${direction === "right" ? "active" : ""}`} onClick={() => setDirection("right")}>Right →</button>
            </div>
          </div>

          <div style={{ paddingBottom: 2, display: "flex", gap: 8 }}>
            <button className="btn primary" onClick={handleSubmit} style={{ padding: "9px 28px" }}>
              Run →
            </button>
            {result && (
              <button className={`btn ${showSaveInput ? "active" : ""}`} onClick={() => setShowSaveInput(!showSaveInput)}>
                Save Run
              </button>
            )}
          </div>

          <div />
        </section>

        {/* ── SAVE SIMULATION INPUT BAR ── */}
        {showSaveInput && (
          <div className="fade-in" style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "16px 24px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 16
          }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder={`Name this simulation (defaults to e.g. "Run: ${result ? result.sequence.length - 1 : 0} reqs")`}
                style={{ borderBottomColor: "var(--border)", fontSize: 14 }}
              />
            </div>
            <button className="btn primary" onClick={handleSaveSimulation} disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm Save"}
            </button>
            <button className="btn" onClick={() => setShowSaveInput(false)}>
              Cancel
            </button>
          </div>
        )}

        {error && (
          <div style={{ color: "var(--dim)", fontSize: 13, letterSpacing: "0.06em", marginBottom: 24, fontStyle: "italic" }}>
            ⚠ {error}
          </div>
        )}

        <hr className="divider" />

        {result && (
          <div className="fade-in dashboard-grid">

            {/* COLUMN 1: VISUALIZATION & RUN DETAILS */}
            <div>
              {/* ── STATS ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1, background: "var(--border)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                {[
                  { val: result.totalSeek, lbl: "Total Seek Time" },
                  { val: result.sequence.length - 1, lbl: "Requests Served" },
                  { val: Math.round(result.totalSeek / Math.max((result.sequence.length - 1), 1)), lbl: "Avg Seek / Request" },
                  { val: result.sequence[result.sequence.length - 1], lbl: "Final Head Position" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "var(--bg)", padding: "20px 24px" }}>
                    <div className="stat-val" style={{ fontSize: 32 }}>{s.val}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* ── VISUALIZATION ── */}
              <div style={{ marginTop: 40 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 16 }}>
                  Disk Arm Visualization
                </div>

                <svg
                  ref={svgRef}
                  width="100%"
                  viewBox={`0 0 ${TRACK_WIDTH} ${svgH}`}
                  style={{ display: "block", overflow: "visible" }}
                >
                  {/* Track axis */}
                  <line x1={48} y1={160} x2={TRACK_WIDTH - 48} y2={160} stroke="var(--border)" strokeWidth={1} />

                  {/* Tick marks */}
                  {[0, 25, 50, 75, 100, 125, 150, 175, 199].map((t) => {
                    const x = trackToX(t);
                    return (
                      <g key={t}>
                        <line x1={x} y1={155} x2={x} y2={165} stroke="var(--dimmer)" strokeWidth={1} />
                        <text x={x} y={178} textAnchor="middle" fontSize={10} fill="var(--dim)" fontFamily="DM Mono, monospace" letterSpacing="0.05em">{t}</text>
                      </g>
                    );
                  })}

                  {/* Axis label */}
                  <text x={TRACK_WIDTH / 2} y={svgH - 4} textAnchor="middle" fontSize={10} fill="var(--dimmer)" fontFamily="DM Mono, monospace" letterSpacing="0.15em">
                    TRACK NUMBER  (0 – 199)
                  </text>

                  {/* Path lines drawn so far */}
                  {pathPoints.length > 0 && (() => {
                    const allPts = [{ x: trackToX(result.sequence[0]), step: 0 }, ...pathPoints];
                    return allPts.slice(0, -1).map((pt, i) => {
                      const next = allPts[i + 1];
                      return (
                        <line
                          key={i}
                          x1={pt.x} y1={160}
                          x2={next.x} y2={160}
                          stroke="var(--dim)"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                      );
                    });
                  })()}

                  {/* Visited dots */}
                  {pathPoints.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x} cy={160} r={3.5}
                      fill="var(--bg)"
                      stroke="var(--dim)"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Queue request markers */}
                  {result.order.map((t, i) => {
                    const x = trackToX(t);
                    const visited = pathPoints.some((p) => p.track === t);
                    return (
                      <g key={i}>
                        <line x1={x} y1={100} x2={x} y2={153} stroke={visited ? "var(--dimmer)" : "var(--border)"} strokeWidth={0.5} strokeDasharray={visited ? "none" : "3 3"} />
                        <circle cx={x} cy={96} r={4} fill={visited ? "var(--white)" : "var(--bg)"} stroke={visited ? "var(--white)" : "var(--dimmer)"} strokeWidth={1} />
                        <text x={x} y={88} textAnchor="middle" fontSize={10} fill={visited ? "var(--dim)" : "var(--dimmer)"} fontFamily="DM Mono, monospace">{t}</text>
                      </g>
                    );
                  })}

                  {/* Arm */}
                  <g className="arm-line" style={{ transform: `translateX(${armVisualX - 0}px)` }}>
                    <line x1={0} y1={40} x2={0} y2={168} stroke="var(--white)" strokeWidth={1.5} strokeLinecap="round" />
                    <polygon points="-5,40 5,40 0,30" fill="var(--white)" />
                    <circle cx={0} cy={160} r={5} fill="var(--white)" />
                  </g>

                  {/* Head label */}
                  <text
                    style={{ transition: "x 0.35s cubic-bezier(0.4,0,0.2,1)" }}
                    x={armVisualX}
                    y={24}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--white)"
                    fontFamily="DM Mono, monospace"
                    letterSpacing="0.08em"
                  >
                    {animStep === -1 ? result.sequence[0] : result.sequence[Math.min(animStep + 1, result.sequence.length - 1)]}
                  </text>
                </svg>
              </div>

              {/* ── PLAYBACK CONTROLS ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                <button className="btn" onClick={handleReset}>↺ Reset</button>
                <button className="btn primary" onClick={handlePlay} style={{ minWidth: 80 }}>
                  {isPlaying ? "⏸ Pause" : animStep >= result.sequence.length - 2 ? "↺ Replay" : "▶ Play"}
                </button>
                <button className="btn" onClick={handleStep} disabled={animStep >= result.sequence.length - 2}>
                  Step →
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--dim)" }}>Speed</span>
                  <input type="range" min={0.5} max={4} step={0.5} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: "var(--dim)", minWidth: 28 }}>{speed}×</span>
                </div>
              </div>

              {/* ── SERVICE ORDER ── */}
              <div style={{ marginTop: 48 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 16 }}>
                  Service Order
                </div>
                <div className="scroll-seq" style={{ display: "flex", alignItems: "center", gap: 0, paddingBottom: 8 }}>
                  {result.sequence.map((t, i) => {
                    let cls = "tag";
                    if (i === 0) cls += " visited";
                    else if (i <= seqDisplayUntil) {
                      cls += i === seqDisplayUntil && animStep >= 0 ? " current" : " visited";
                    }
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        <span className={cls} style={{ minWidth: 48, textAlign: "center", fontSize: 13 }}>{t}</span>
                        {i < result.sequence.length - 1 && (
                          <span style={{ color: "var(--border)", fontSize: 10, padding: "0 4px" }}>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SEEK TABLE ── */}
              <div style={{ marginTop: 48 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 16 }}>
                  Seek Operations
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 1fr", borderTop: "1px solid var(--border)" }}>
                  {["#", "From", "To", "Distance"].map((h) => (
                    <div key={h} style={{ padding: "8px 0", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--dimmer)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </div>
                  ))}
                  {result.sequence.slice(0, -1).map((from, i) => {
                    const to = result.sequence[i + 1];
                    const dist = Math.abs(to - from);
                    const isActive = i + 1 === seqDisplayUntil;
                    const isDone = i + 1 <= seqDisplayUntil;
                    return [
                      <div key={`n${i}`} style={{ padding: "10px 0", fontSize: 12, color: isDone ? "var(--dimmer)" : "var(--border)", borderBottom: "1px solid var(--border)", background: isActive ? "var(--surface)" : "transparent" }}>{i + 1}</div>,
                      <div key={`f${i}`} style={{ padding: "10px 0", fontSize: 13, color: isDone ? "var(--dim)" : "var(--dimmer)", borderBottom: "1px solid var(--border)", background: isActive ? "var(--surface)" : "transparent", fontVariantNumeric: "tabular-nums" }}>{from}</div>,
                      <div key={`t${i}`} style={{ padding: "10px 0", fontSize: 13, color: isDone ? "var(--dim)" : "var(--dimmer)", borderBottom: "1px solid var(--border)", background: isActive ? "var(--surface)" : "transparent", fontVariantNumeric: "tabular-nums" }}>{to}</div>,
                      <div key={`d${i}`} style={{ padding: "10px 0", fontSize: 13, color: isActive ? "var(--white)" : isDone ? "var(--dim)" : "var(--dimmer)", borderBottom: "1px solid var(--border)", background: isActive ? "var(--surface)" : "transparent", fontVariantNumeric: "tabular-nums", fontWeight: isActive ? 500 : 400 }}>+{dist}</div>,
                    ];
                  })}
                </div>
              </div>
            </div>

            {/* COLUMN 2: COMPARATIVE ANALYTICS & DATABASE HISTORY */}
            <div className="sidebar-panel">

              {/* ── COMPARISON CHART ── */}
              <div style={{ marginBottom: 48 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 20 }}>
                  Algorithm Comparison (Total Seek)
                </div>
                {comparisonResults && (() => {
                  const algs = [
                    { name: "FCFS", seek: comparisonResults.fcfs },
                    { name: "SSTF", seek: comparisonResults.sstf },
                    { name: "SCAN", seek: comparisonResults.scan },
                    { name: "LOOK", seek: comparisonResults.look, isLook: true },
                    { name: "C-SCAN", seek: comparisonResults.cscan },
                    { name: "C-LOOK", seek: comparisonResults.clook },
                  ];
                  const maxSeek = Math.max(...algs.map((a) => a.seek), 1);
                  const minSeek = Math.min(...algs.map((a) => a.seek));

                  return (
                    <div>
                      {algs.map((alg) => {
                        const widthPct = (alg.seek / maxSeek) * 100;
                        const isBest = alg.seek === minSeek;
                        return (
                          <div key={alg.name} className="comparison-bar-container">
                            <span className="comparison-bar-label" style={{ color: alg.isLook ? "var(--white)" : "var(--dim)", fontWeight: alg.isLook ? 550 : 400 }}>
                              {alg.name} {alg.isLook && "★"}
                            </span>
                            <div className="comparison-bar-track">
                              <div
                                className="comparison-bar-fill"
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: isBest ? "#10b981" : alg.isLook ? "var(--white)" : "var(--dimmer)"
                                }}
                              />
                            </div>
                            <span className="comparison-bar-value" style={{ color: isBest ? "#10b981" : alg.isLook ? "var(--white)" : "var(--dim)" }}>
                              {alg.seek}
                            </span>
                          </div>
                        );
                      })}

                      {(() => {
                        const fSeek = comparisonResults.fcfs;
                        const lSeek = comparisonResults.look;
                        if (fSeek > lSeek) {
                          const imp = Math.round(((fSeek - lSeek) / fSeek) * 100);
                          return (
                            <div style={{ marginTop: 24, fontSize: 12, color: "var(--dim)", letterSpacing: "0.02em", fontStyle: "italic", lineHeight: 1.6 }}>
                              💡 In this run, <strong style={{ color: "var(--white)" }}>LOOK</strong> reduces disk arm movement by <strong style={{ color: "#10b981" }}>{imp}%</strong> compared to a basic FCFS queue.
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })()}
              </div>

              {/* ── HISTORY LIST ── */}
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 20 }}>
                  Saved Simulations ({simulations.length})
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto", paddingRight: 8 }}>
                  {simulations.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--dimmer)", fontStyle: "italic", letterSpacing: "0.04em" }}>
                      No saved simulations yet. Run a configuration and click "Save Run" to persist it.
                    </div>
                  ) : (
                    simulations.map((sim) => (
                      <div
                        key={sim._id}
                        className="history-card fade-in"
                        onClick={() => handleLoadSimulation(sim)}
                      >
                        {/* Card Header */}
                        <div className="history-card-header">
                          <span className="history-card-title">{sim.title}</span>
                          <button
                            className="history-card-delete"
                            onClick={(e) => handleDeleteSimulation(sim._id, e)}
                            title="Delete simulation"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Card Meta */}
                        <div className="history-card-meta">
                          Head: {sim.head} · Dir: {sim.direction} · {sim.queue.length} tracks
                        </div>

                        {/* Live Metrics Grid (updated by backend on dispatch) */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 1,
                          background: "var(--border)",
                          marginBottom: 10,
                          marginTop: 4,
                        }}>
                          {[
                            { label: "LOOK", val: sim.lookResult.totalSeek, highlight: true },
                            { label: "SSTF", val: sim.comparison.sstfSeek },
                            { label: "FCFS", val: sim.comparison.fcfsSeek },
                            { label: "SCAN", val: sim.comparison.scanSeek },
                            { label: "C-SCAN", val: sim.comparison.cscanSeek },
                            { label: "C-LOOK", val: sim.comparison.clookSeek },
                          ].map(({ label, val, highlight }) => (
                            <div key={label} style={{
                              background: "var(--bg)",
                              padding: "6px 8px",
                              textAlign: "center"
                            }}>
                              <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--dimmer)", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 14, fontWeight: highlight ? 700 : 400, color: highlight ? "var(--white)" : "var(--dim)" }}>{val}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── LIVE DISPATCH PANEL ── */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            background: "var(--bg)",
                            border: "1px dashed var(--border)",
                          }}
                        >
                          <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--dimmer)", marginBottom: 8 }}>
                            ⚡ Dispatch New Track → Backend recalculates
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="number"
                              min={0}
                              max={199}
                              placeholder="Track 0–199"
                              value={dispatchInputs[sim._id] || ""}
                              onChange={(e) =>
                                setDispatchInputs((prev) => ({ ...prev, [sim._id]: e.target.value }))
                              }
                              style={{ flex: 1, fontSize: 13, padding: "4px 2px" }}
                            />
                            <button
                              className="btn primary"
                              style={{ padding: "6px 14px", fontSize: 11 }}
                              disabled={dispatchingId === sim._id}
                              onClick={(e) => handleDispatchTrack(sim, e)}
                            >
                              {dispatchingId === sim._id ? "..." : "Dispatch →"}
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--dimmer)", marginTop: 6, fontStyle: "italic" }}>
                            Sends PUT /api/simulations/{sim._id.slice(-6)}/dispatch · Node.js computes · MongoDB saves
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ── LIVE AUDIT LOGS FROM MONGODB (NEW FEATURE FOR TEACHER DEMO) ── */}
        {result && (
          <div className="fade-in" style={{
            marginTop: 48,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "24px",
            borderRadius: "4px"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 24,
              flexWrap: "wrap"
            }}>
              <div>
                <h3 className="serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--white)" }}>
                  💻 System Activity Logs (Live MONGODB transactions)
                </h3>
                <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>
                  Every click event below triggers a REST request (`POST /api/logs`) that writes a new record directly to MongoDB. The console below dynamically pulls these records.
                </p>
              </div>
              <button className="btn" onClick={handleClearLogs} style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                Clear DB Logs
              </button>
            </div>
            
            {/* Terminal Panel */}
            <div style={{
              background: "#050505",
              color: "#34d399",
              padding: "16px 20px",
              fontFamily: "'DM Mono', monospace",
              fontSize: "12px",
              height: "220px",
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              lineHeight: "1.6"
            }}>
              {dbLogs.length === 0 ? (
                <div style={{ color: "#777", fontStyle: "italic" }}>
                  &gt; Console idle. Perform an action (toggle theme, load preset, run visualizer) to write to MongoDB...
                </div>
              ) : (
                dbLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString();
                  return (
                    <div key={log._id} style={{ display: "flex", gap: 12, borderBottom: "1px solid #141414", padding: "6px 0", alignItems: "center" }}>
                      <span style={{ color: "#666" }}>[{dateStr}]</span>
                      <span style={{ color: "#38bdf8", fontWeight: "bold", minWidth: 160 }}>{log.action}</span>
                      <span style={{ color: "var(--border)" }}>|</span>
                      <span style={{ color: "#a7f3d0" }}>{log.details}</span>
                      <span style={{ color: "#444", marginLeft: "auto", fontSize: "10px" }}>ID: {log._id}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── ALGORITHM EXPLANATION ── */}
        {result && (
          <div className="fade-in" style={{ marginTop: 64, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1, background: "var(--border)" }}>
            {[
              {
                step: "01",
                title: "Sort & Partition",
                body: "Requests are sorted and split into two groups: those to the left and right of the current head position.",
              },
              {
                step: "02",
                title: "Service Direction",
                body: "The arm services all requests in the initial direction first, traveling only as far as the outermost request — then reverses.",
              },
              {
                step: "03",
                title: "No Edge Travel",
                body: "Unlike SCAN, LOOK never travels to track 0 or 199 unless a request exists there — minimizing unnecessary movement.",
              },
            ].map((card) => (
              <div key={card.step} style={{ background: "var(--bg)", padding: "32px" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--dimmer)", marginBottom: 16 }}>{card.step}</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: "var(--white)", marginBottom: 12, letterSpacing: "-0.01em" }}>
                  {card.title}
                </div>
                <p style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.7, letterSpacing: "0.03em" }}>{card.body}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--dimmer)" }}>
          LOOK Disk Scheduling
        </span>
        <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--border)" }}>
          O(n log n) · Tracks 0–199
        </span>
      </footer>
    </div>
  );
}
