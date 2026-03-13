import { useState, useEffect, useMemo, useCallback } from "react";

// ══════════════════════════════════════════════════════════════
// FP&A BUDGET SIMULATOR — Financial Planning & Analysis Engine
// Zero APIs · 100% Free · Built-in Financial Models
// ══════════════════════════════════════════════════════════════

const C = {
  bg: "#06080f", panel: "#0f1420", border: "#1a2235", hover: "#141d30",
  accent: "#6366f1", accentDim: "rgba(99,102,241,0.12)", accentGlow: "rgba(99,102,241,0.25)",
  green: "#10b981", greenDim: "rgba(16,185,129,0.12)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.12)",
  amber: "#f59e0b", amberDim: "rgba(245,158,11,0.12)",
  blue: "#3b82f6", blueDim: "rgba(59,130,246,0.12)",
  cyan: "#06b6d4",
  text: "#e2e8f0", muted: "#94a3b8", dim: "#475569",
  gold: "#fbbf24",
};

const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toFixed(0);
};
const fmtPct = (n) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
const fmtCurrency = (n) => "$" + fmt(n);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Default Budget Data ────────────────────────────────────
const DEFAULT_BUDGET = {
  revenue: {
    "Product Sales": [420000,380000,450000,470000,510000,490000,530000,550000,520000,580000,610000,650000],
    "Service Revenue": [180000,175000,190000,195000,200000,210000,215000,220000,225000,230000,240000,250000],
    "Subscription": [95000,97000,99000,101000,103000,106000,108000,110000,113000,115000,118000,120000],
    "Licensing Fees": [45000,45000,48000,48000,50000,50000,52000,52000,55000,55000,58000,60000],
  },
  expenses: {
    "COGS": [280000,260000,295000,305000,330000,320000,345000,355000,340000,375000,392000,415000],
    "Salaries & Benefits": [210000,210000,210000,215000,215000,220000,220000,225000,225000,230000,230000,235000],
    "Marketing": [65000,70000,75000,80000,85000,78000,82000,88000,72000,90000,95000,105000],
    "Rent & Utilities": [42000,42000,42000,42000,42000,43000,43000,43000,43000,43000,44000,44000],
    "Technology & IT": [35000,35000,38000,36000,40000,37000,39000,41000,38000,42000,40000,45000],
    "Travel & Entertainment": [15000,12000,18000,20000,22000,16000,14000,25000,18000,20000,24000,28000],
    "Professional Fees": [25000,20000,22000,18000,30000,24000,20000,22000,26000,28000,20000,35000],
    "Depreciation": [18000,18000,18000,18000,18000,18000,18000,18000,18000,18000,18000,18000],
  },
};

const generateActuals = (budget, variance = 0.08) => {
  const result = {};
  Object.entries(budget).forEach(([cat, items]) => {
    result[cat] = {};
    Object.entries(items).forEach(([name, months]) => {
      result[cat][name] = months.map(v => {
        const swing = (Math.random() - 0.45) * variance;
        return Math.round(v * (1 + swing));
      });
    });
  });
  return result;
};

// ─── Components ─────────────────────────────────────────────
const Panel = ({ children, style, glow }) => (
  <div style={{
    background: C.panel, border: `1px solid ${glow ? C.accent : C.border}`,
    borderRadius: 10, padding: 18,
    boxShadow: glow ? `0 0 24px ${C.accentGlow}` : "0 2px 12px rgba(0,0,0,0.4)",
    ...style,
  }}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14 }}>{children}</div>
);

const KPI = ({ label, value, sub, color = C.accent, small }) => (
  <div style={{ textAlign: "center", padding: small ? "4px 0" : "0" }}>
    <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Badge = ({ text, color, bg }) => (
  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, color, background: bg, letterSpacing: "0.3px" }}>{text}</span>
);

const SliderControl = ({ label, value, min, max, step, onChange, format = v => v, color = C.accent }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace" }}>{format(value)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", accentColor: color, height: 4, cursor: "pointer" }} />
  </div>
);

// ─── Waterfall Chart ────────────────────────────────────────
const WaterfallChart = ({ data, width = 600, height = 220 }) => {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.cumulative || d.value)), 1);
  const scale = (height - 60) / (maxAbs * 1.3);
  const barW = Math.min(50, (width - 80) / data.length - 6);
  const baseline = height - 30;
  
  let running = 0;
  const bars = data.map((d, i) => {
    const isTotal = d.isTotal;
    const start = isTotal ? 0 : running;
    const end = isTotal ? d.value : running + d.value;
    running = end;
    const y = baseline - Math.max(start, end) * scale;
    const h = Math.abs(d.value) * scale;
    const color = isTotal ? C.accent : d.value >= 0 ? C.green : C.red;
    const x = 50 + i * ((width - 60) / data.length);
    return { ...d, x, y, h, color, barW };
  });

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <line x1="48" y1={baseline} x2={width} y2={baseline} stroke={C.border} strokeWidth="1" />
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={barW} height={Math.max(2, b.h)} rx={3} fill={b.color} opacity={0.85}
            style={{ transition: "all 0.5s ease" }} />
          <text x={b.x + barW / 2} y={b.y - 6} fill={b.color} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="monospace">
            {fmtCurrency(b.value)}
          </text>
          <text x={b.x + barW / 2} y={baseline + 14} fill={C.dim} fontSize="7.5" textAnchor="middle" fontFamily="monospace">
            {b.label.length > 10 ? b.label.slice(0, 9) + "…" : b.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Sparkline ──────────────────────────────────────────────
const Sparkline = ({ data, color = C.accent, width = 120, height = 32 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Monthly Bar Comparison ─────────────────────────────────
const MonthlyComparison = ({ budget, actual, height = 180 }) => {
  const max = Math.max(...budget, ...actual);
  const barW = 14;
  const gap = 3;
  const groupW = barW * 2 + gap;
  const w = 12 * groupW + 80;
  const chartH = height - 36;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`}>
      {[0, 0.5, 1].map((f, i) => (
        <g key={i}>
          <line x1="38" y1={10 + chartH * (1 - f)} x2={w} y2={10 + chartH * (1 - f)} stroke={C.border} strokeDasharray="2,3" />
          <text x="34" y={14 + chartH * (1 - f)} fill={C.dim} fontSize="8" textAnchor="end" fontFamily="monospace">{fmt(max * f)}</text>
        </g>
      ))}
      {MONTHS.map((m, i) => {
        const x = 44 + i * groupW;
        const bH = (budget[i] / max) * chartH;
        const aH = (actual[i] / max) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={10 + chartH - bH} width={barW} height={bH} rx={2} fill={C.blue} opacity={0.5} />
            <rect x={x + barW + gap} y={10 + chartH - aH} width={barW} height={aH} rx={2} fill={actual[i] >= budget[i] ? C.green : C.red} opacity={0.8} />
            <text x={x + groupW / 2} y={height - 4} fill={C.dim} fontSize="7.5" textAnchor="middle">{m}</text>
          </g>
        );
      })}
      <g transform={`translate(${w - 90}, 6)`}>
        <rect x="0" y="0" width="8" height="8" rx="2" fill={C.blue} opacity={0.5} />
        <text x="12" y="7" fill={C.muted} fontSize="8">Budget</text>
        <rect x="45" y="0" width="8" height="8" rx="2" fill={C.green} opacity={0.8} />
        <text x="57" y="7" fill={C.muted} fontSize="8">Actual</text>
      </g>
    </svg>
  );
};

// ─── Scenario Panel ─────────────────────────────────────────
const ScenarioPanel = ({ scenario, budget, onChange }) => {
  const scenarioConfigs = {
    base: { revenueGrowth: 0, costChange: 0, label: "Base Case", color: C.accent },
    optimistic: { revenueGrowth: 0.15, costChange: -0.05, label: "Bull Case", color: C.green },
    pessimistic: { revenueGrowth: -0.12, costChange: 0.08, label: "Bear Case", color: C.red },
    custom: { revenueGrowth: 0, costChange: 0, label: "Custom", color: C.amber },
  };

  const [activeScenario, setActiveScenario] = useState("base");
  const [customRevGrowth, setCustomRevGrowth] = useState(0);
  const [customCostChange, setCustomCostChange] = useState(0);
  const [customHeadcountChange, setCustomHeadcountChange] = useState(0);
  const [customMarketingMult, setCustomMarketingMult] = useState(1.0);

  const getScenarioData = useCallback(() => {
    const config = activeScenario === "custom"
      ? { revenueGrowth: customRevGrowth, costChange: customCostChange }
      : scenarioConfigs[activeScenario];

    const projected = { revenue: {}, expenses: {} };
    Object.entries(budget.revenue).forEach(([name, months]) => {
      projected.revenue[name] = months.map(v => Math.round(v * (1 + config.revenueGrowth)));
    });
    Object.entries(budget.expenses).forEach(([name, months]) => {
      let mult = 1 + config.costChange;
      if (activeScenario === "custom") {
        if (name === "Salaries & Benefits") mult += customHeadcountChange * 0.1;
        if (name === "Marketing") mult = customMarketingMult;
      }
      projected.expenses[name] = months.map(v => Math.round(v * mult));
    });
    return { projected, config };
  }, [activeScenario, customRevGrowth, customCostChange, customHeadcountChange, customMarketingMult, budget]);

  const { projected, config } = getScenarioData();
  
  const totalRevBudget = Object.values(budget.revenue).flat().reduce((a, b) => a + b, 0);
  const totalExpBudget = Object.values(budget.expenses).flat().reduce((a, b) => a + b, 0);
  const totalRevProjected = Object.values(projected.revenue).flat().reduce((a, b) => a + b, 0);
  const totalExpProjected = Object.values(projected.expenses).flat().reduce((a, b) => a + b, 0);
  const netIncomeBudget = totalRevBudget - totalExpBudget;
  const netIncomeProjected = totalRevProjected - totalExpProjected;
  const marginBudget = netIncomeBudget / totalRevBudget;
  const marginProjected = netIncomeProjected / totalRevProjected;

  const waterfallData = [
    { label: "Revenue", value: totalRevProjected, isTotal: false },
    ...Object.entries(projected.expenses).map(([name, months]) => ({
      label: name, value: -months.reduce((a, b) => a + b, 0),
    })),
    { label: "Net Income", value: netIncomeProjected, isTotal: true },
  ];

  return (
    <div>
      {/* Scenario Selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {Object.entries(scenarioConfigs).map(([key, cfg]) => (
          <button key={key} onClick={() => setActiveScenario(key)}
            style={{
              padding: "7px 16px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.5px", transition: "all 0.2s",
              background: activeScenario === key ? cfg.color + "20" : "transparent",
              color: activeScenario === key ? cfg.color : C.dim,
              border: `1px solid ${activeScenario === key ? cfg.color + "50" : C.border}`,
            }}>
            {cfg.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Custom Sliders */}
      {activeScenario === "custom" && (
        <Panel style={{ marginBottom: 16, background: C.amberDim }}>
          <SectionTitle>Custom Scenario Parameters</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <SliderControl label="Revenue Growth" value={customRevGrowth} min={-0.30} max={0.30} step={0.01}
              onChange={setCustomRevGrowth} format={v => fmtPct(v)} color={customRevGrowth >= 0 ? C.green : C.red} />
            <SliderControl label="Cost Change" value={customCostChange} min={-0.20} max={0.25} step={0.01}
              onChange={setCustomCostChange} format={v => fmtPct(v)} color={customCostChange <= 0 ? C.green : C.red} />
            <SliderControl label="Headcount Change" value={customHeadcountChange} min={-3} max={5} step={1}
              onChange={setCustomHeadcountChange} format={v => (v >= 0 ? "+" : "") + v + " FTE"} color={C.blue} />
            <SliderControl label="Marketing Multiplier" value={customMarketingMult} min={0.5} max={2.0} step={0.1}
              onChange={setCustomMarketingMult} format={v => v.toFixed(1) + "x"} color={C.amber} />
          </div>
        </Panel>
      )}

      {/* Scenario KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Projected Revenue", value: fmtCurrency(totalRevProjected), sub: fmtPct((totalRevProjected - totalRevBudget) / totalRevBudget) + " vs budget", color: totalRevProjected >= totalRevBudget ? C.green : C.red },
          { label: "Projected Expenses", value: fmtCurrency(totalExpProjected), sub: fmtPct((totalExpProjected - totalExpBudget) / totalExpBudget) + " vs budget", color: totalExpProjected <= totalExpBudget ? C.green : C.red },
          { label: "Net Income", value: fmtCurrency(netIncomeProjected), sub: fmtPct((netIncomeProjected - netIncomeBudget) / Math.abs(netIncomeBudget)) + " vs budget", color: netIncomeProjected >= netIncomeBudget ? C.green : C.red },
          { label: "Net Margin", value: (marginProjected * 100).toFixed(1) + "%", sub: "Budget: " + (marginBudget * 100).toFixed(1) + "%", color: marginProjected >= marginBudget ? C.green : C.amber },
        ].map((k, i) => (
          <Panel key={i}><KPI {...k} small /></Panel>
        ))}
      </div>

      {/* Waterfall */}
      <Panel style={{ marginBottom: 16 }}>
        <SectionTitle>Income Waterfall — {scenarioConfigs[activeScenario].label}</SectionTitle>
        <WaterfallChart data={waterfallData} />
      </Panel>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function FPABudgetSimulator() {
  const [budget] = useState(DEFAULT_BUDGET);
  const [actuals] = useState(() => generateActuals(DEFAULT_BUDGET));
  const [activeTab, setActiveTab] = useState("overview");
  const [animate, setAnimate] = useState(false);

  useEffect(() => { setTimeout(() => setAnimate(true), 80); }, []);

  // ─── Computed Metrics ───────────────────────────────────
  const metrics = useMemo(() => {
    const sumAll = (obj) => Object.values(obj).flat().reduce((a, b) => a + b, 0);
    const sumByMonth = (obj) => {
      const monthly = Array(12).fill(0);
      Object.values(obj).forEach(arr => arr.forEach((v, i) => monthly[i] += v));
      return monthly;
    };

    const totalRevBudget = sumAll(budget.revenue);
    const totalRevActual = sumAll(actuals.revenue);
    const totalExpBudget = sumAll(budget.expenses);
    const totalExpActual = sumAll(actuals.expenses);
    const netBudget = totalRevBudget - totalExpBudget;
    const netActual = totalRevActual - totalExpActual;

    const monthlyRevBudget = sumByMonth(budget.revenue);
    const monthlyRevActual = sumByMonth(actuals.revenue);
    const monthlyExpBudget = sumByMonth(budget.expenses);
    const monthlyExpActual = sumByMonth(actuals.expenses);
    const monthlyNetBudget = monthlyRevBudget.map((v, i) => v - monthlyExpBudget[i]);
    const monthlyNetActual = monthlyRevActual.map((v, i) => v - monthlyExpActual[i]);

    // Variance by line item
    const revenueVariance = {};
    Object.entries(budget.revenue).forEach(([name, bMonths]) => {
      const bTotal = bMonths.reduce((a, b) => a + b, 0);
      const aTotal = actuals.revenue[name].reduce((a, b) => a + b, 0);
      revenueVariance[name] = { budget: bTotal, actual: aTotal, variance: aTotal - bTotal, pct: (aTotal - bTotal) / bTotal };
    });
    const expenseVariance = {};
    Object.entries(budget.expenses).forEach(([name, bMonths]) => {
      const bTotal = bMonths.reduce((a, b) => a + b, 0);
      const aTotal = actuals.expenses[name].reduce((a, b) => a + b, 0);
      expenseVariance[name] = { budget: bTotal, actual: aTotal, variance: aTotal - bTotal, pct: (aTotal - bTotal) / bTotal };
    });

    return {
      totalRevBudget, totalRevActual, totalExpBudget, totalExpActual, netBudget, netActual,
      monthlyRevBudget, monthlyRevActual, monthlyExpBudget, monthlyExpActual, monthlyNetBudget, monthlyNetActual,
      revenueVariance, expenseVariance,
      marginBudget: netBudget / totalRevBudget, marginActual: netActual / totalRevActual,
      opexRatioBudget: totalExpBudget / totalRevBudget, opexRatioActual: totalExpActual / totalRevActual,
    };
  }, [budget, actuals]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "variance", label: "Variance Analysis" },
    { id: "scenarios", label: "What-If Scenarios" },
    { id: "pnl", label: "P&L Statement" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input[type=range] { -webkit-appearance: none; background: ${C.border}; border-radius: 4px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${C.accent}; cursor: pointer; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeIn 0.5s ease forwards; opacity: 0; }
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.bg}, ${C.panel}, ${C.bg})`,
        borderBottom: `1px solid ${C.border}`, padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
          }}>FP</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.5px" }}>FP&A BUDGET SIMULATOR</div>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: "1.5px" }}>FINANCIAL PLANNING & ANALYSIS ENGINE</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>FY 2026 · 12-MONTH MODEL</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 24px 0", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.5px",
            background: activeTab === t.id ? C.accentDim : "transparent",
            color: activeTab === t.id ? C.accent : C.dim, border: "none",
            borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            borderRadius: "6px 6px 0 0", transition: "all 0.2s",
          }}>{t.label.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <div className={animate ? "anim" : ""}>
            {/* Top KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Revenue (Actual)", value: fmtCurrency(metrics.totalRevActual), sub: fmtPct((metrics.totalRevActual - metrics.totalRevBudget) / metrics.totalRevBudget) + " vs budget", color: metrics.totalRevActual >= metrics.totalRevBudget ? C.green : C.red },
                { label: "Expenses (Actual)", value: fmtCurrency(metrics.totalExpActual), sub: fmtPct((metrics.totalExpActual - metrics.totalExpBudget) / metrics.totalExpBudget) + " vs budget", color: metrics.totalExpActual <= metrics.totalExpBudget ? C.green : C.red },
                { label: "Net Income", value: fmtCurrency(metrics.netActual), sub: "Budget: " + fmtCurrency(metrics.netBudget), color: metrics.netActual >= metrics.netBudget ? C.green : C.red },
                { label: "Net Margin", value: (metrics.marginActual * 100).toFixed(1) + "%", sub: "Budget: " + (metrics.marginBudget * 100).toFixed(1) + "%", color: metrics.marginActual >= metrics.marginBudget ? C.green : C.amber },
                { label: "OpEx Ratio", value: (metrics.opexRatioActual * 100).toFixed(1) + "%", sub: "Budget: " + (metrics.opexRatioBudget * 100).toFixed(1) + "%", color: metrics.opexRatioActual <= metrics.opexRatioBudget ? C.green : C.red },
              ].map((k, i) => <Panel key={i}><KPI {...k} /></Panel>)}
            </div>

            {/* Monthly Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 18 }}>
              <Panel>
                <SectionTitle>Revenue — Budget vs Actual</SectionTitle>
                <MonthlyComparison budget={metrics.monthlyRevBudget} actual={metrics.monthlyRevActual} />
              </Panel>
              <Panel>
                <SectionTitle>Net Income — Budget vs Actual</SectionTitle>
                <MonthlyComparison budget={metrics.monthlyNetBudget} actual={metrics.monthlyNetActual} />
              </Panel>
            </div>

            {/* Sparklines */}
            <Panel>
              <SectionTitle>Revenue Streams — Monthly Trend</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {Object.entries(actuals.revenue).map(([name, data], i) => {
                  const total = data.reduce((a, b) => a + b, 0);
                  const bTotal = budget.revenue[name].reduce((a, b) => a + b, 0);
                  const varPct = (total - bTotal) / bTotal;
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: C.bg }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{name}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: C.accent, fontFamily: "monospace" }}>{fmtCurrency(total)}</span>
                          <Badge text={fmtPct(varPct)} color={varPct >= 0 ? C.green : C.red} bg={varPct >= 0 ? C.greenDim : C.redDim} />
                        </div>
                      </div>
                      <Sparkline data={data} color={[C.accent, C.green, C.blue, C.amber][i % 4]} />
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}

        {/* ─── VARIANCE TAB ─── */}
        {activeTab === "variance" && (
          <div className={animate ? "anim" : ""}>
            {[
              { title: "Revenue Variance", data: metrics.revenueVariance, favorable: (v) => v >= 0 },
              { title: "Expense Variance", data: metrics.expenseVariance, favorable: (v) => v <= 0 },
            ].map(({ title, data, favorable }) => (
              <Panel key={title} style={{ marginBottom: 16 }}>
                <SectionTitle>{title}</SectionTitle>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 550 }}>
                    <thead>
                      <tr>
                        {["Line Item", "Budget", "Actual", "Variance ($)", "Variance (%)", "Status"].map(h => (
                          <th key={h} style={{ textAlign: h === "Line Item" ? "left" : "right", padding: "8px 12px", fontSize: 9, color: C.dim, borderBottom: `1px solid ${C.border}`, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data).map(([name, d]) => {
                        const isFav = favorable(d.variance);
                        const color = isFav ? C.green : C.red;
                        return (
                          <tr key={name} style={{ borderBottom: `1px solid ${C.border}08` }}>
                            <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.text }}>{name}</td>
                            <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: C.muted, textAlign: "right" }}>{fmtCurrency(d.budget)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: C.text, textAlign: "right", fontWeight: 600 }}>{fmtCurrency(d.actual)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color, textAlign: "right", fontWeight: 700 }}>
                              {d.variance >= 0 ? "+" : ""}{fmtCurrency(d.variance)}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <Badge text={fmtPct(d.pct)} color={color} bg={color + "18"} />
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <Badge text={isFav ? "FAVORABLE" : "UNFAVORABLE"} color={color} bg={color + "15"} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: `2px solid ${C.border}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: C.accent }}>TOTAL</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: C.muted, textAlign: "right", fontWeight: 700 }}>
                          {fmtCurrency(Object.values(data).reduce((s, d) => s + d.budget, 0))}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: C.text, textAlign: "right", fontWeight: 800 }}>
                          {fmtCurrency(Object.values(data).reduce((s, d) => s + d.actual, 0))}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "right", fontWeight: 800,
                          color: favorable(Object.values(data).reduce((s, d) => s + d.variance, 0)) ? C.green : C.red }}>
                          {fmtCurrency(Object.values(data).reduce((s, d) => s + d.variance, 0))}
                        </td>
                        <td colSpan="2" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}
          </div>
        )}

        {/* ─── SCENARIOS TAB ─── */}
        {activeTab === "scenarios" && (
          <div className={animate ? "anim" : ""}>
            <ScenarioPanel budget={budget} />
          </div>
        )}

        {/* ─── P&L TAB ─── */}
        {activeTab === "pnl" && (
          <div className={animate ? "anim" : ""}>
            <Panel>
              <SectionTitle>Profit & Loss Statement — FY 2026</SectionTitle>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 9, color: C.dim, borderBottom: `2px solid ${C.border}`, letterSpacing: "1px", position: "sticky", left: 0, background: C.panel, minWidth: 150 }}>LINE ITEM</th>
                      {MONTHS.map(m => (
                        <th key={m} style={{ textAlign: "right", padding: "8px 6px", fontSize: 9, color: C.dim, borderBottom: `2px solid ${C.border}`, letterSpacing: "0.5px", minWidth: 65 }}>{m.toUpperCase()}</th>
                      ))}
                      <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 9, color: C.accent, borderBottom: `2px solid ${C.accent}40`, letterSpacing: "1px", fontWeight: 800, minWidth: 80 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue Section */}
                    <tr><td colSpan={14} style={{ padding: "12px 10px 4px", fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: "1px" }}>REVENUE</td></tr>
                    {Object.entries(actuals.revenue).map(([name, months]) => (
                      <tr key={name}>
                        <td style={{ padding: "6px 10px 6px 20px", fontSize: 11, color: C.text, position: "sticky", left: 0, background: C.panel }}>{name}</td>
                        {months.map((v, i) => (
                          <td key={i} style={{ padding: "6px", fontSize: 11, fontFamily: "monospace", color: C.muted, textAlign: "right" }}>{(v / 1000).toFixed(0)}K</td>
                        ))}
                        <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.text, textAlign: "right", fontWeight: 700 }}>{fmtCurrency(months.reduce((a, b) => a + b, 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 800, color: C.green, position: "sticky", left: 0, background: C.panel }}>TOTAL REVENUE</td>
                      {metrics.monthlyRevActual.map((v, i) => (
                        <td key={i} style={{ padding: "6px", fontSize: 11, fontFamily: "monospace", color: C.green, textAlign: "right", fontWeight: 700 }}>{(v / 1000).toFixed(0)}K</td>
                      ))}
                      <td style={{ padding: "6px 10px", fontSize: 12, fontFamily: "monospace", color: C.green, textAlign: "right", fontWeight: 800 }}>{fmtCurrency(metrics.totalRevActual)}</td>
                    </tr>

                    {/* Expenses Section */}
                    <tr><td colSpan={14} style={{ padding: "16px 10px 4px", fontSize: 11, fontWeight: 800, color: C.red, letterSpacing: "1px" }}>EXPENSES</td></tr>
                    {Object.entries(actuals.expenses).map(([name, months]) => (
                      <tr key={name}>
                        <td style={{ padding: "6px 10px 6px 20px", fontSize: 11, color: C.text, position: "sticky", left: 0, background: C.panel }}>{name}</td>
                        {months.map((v, i) => (
                          <td key={i} style={{ padding: "6px", fontSize: 11, fontFamily: "monospace", color: C.muted, textAlign: "right" }}>{(v / 1000).toFixed(0)}K</td>
                        ))}
                        <td style={{ padding: "6px 10px", fontSize: 11, fontFamily: "monospace", color: C.text, textAlign: "right", fontWeight: 700 }}>{fmtCurrency(months.reduce((a, b) => a + b, 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 800, color: C.red, position: "sticky", left: 0, background: C.panel }}>TOTAL EXPENSES</td>
                      {metrics.monthlyExpActual.map((v, i) => (
                        <td key={i} style={{ padding: "6px", fontSize: 11, fontFamily: "monospace", color: C.red, textAlign: "right", fontWeight: 700 }}>{(v / 1000).toFixed(0)}K</td>
                      ))}
                      <td style={{ padding: "6px 10px", fontSize: 12, fontFamily: "monospace", color: C.red, textAlign: "right", fontWeight: 800 }}>{fmtCurrency(metrics.totalExpActual)}</td>
                    </tr>

                    {/* Net Income */}
                    <tr style={{ borderTop: `2px solid ${C.accent}40` }}>
                      <td style={{ padding: "12px 10px", fontSize: 12, fontWeight: 900, color: C.accent, position: "sticky", left: 0, background: C.panel }}>NET INCOME</td>
                      {metrics.monthlyNetActual.map((v, i) => (
                        <td key={i} style={{ padding: "6px", fontSize: 12, fontFamily: "monospace", color: v >= 0 ? C.green : C.red, textAlign: "right", fontWeight: 800 }}>{(v / 1000).toFixed(0)}K</td>
                      ))}
                      <td style={{
                        padding: "6px 10px", fontSize: 14, fontFamily: "monospace", textAlign: "right", fontWeight: 900,
                        color: metrics.netActual >= 0 ? C.green : C.red,
                      }}>{fmtCurrency(metrics.netActual)}</td>
                    </tr>

                    {/* Margin */}
                    <tr>
                      <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.dim, position: "sticky", left: 0, background: C.panel }}>NET MARGIN</td>
                      {metrics.monthlyNetActual.map((v, i) => {
                        const margin = v / metrics.monthlyRevActual[i];
                        return (
                          <td key={i} style={{ padding: "6px", fontSize: 10, fontFamily: "monospace", color: margin >= 0.10 ? C.green : C.amber, textAlign: "right" }}>{(margin * 100).toFixed(1)}%</td>
                        );
                      })}
                      <td style={{ padding: "6px 10px", fontSize: 12, fontFamily: "monospace", color: C.accent, textAlign: "right", fontWeight: 800 }}>{(metrics.marginActual * 100).toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0 12px", fontSize: 10, color: C.dim, letterSpacing: "1px" }}>
          FP&A BUDGET SIMULATOR · ZERO API DEPENDENCIES · KARTIK JOSHI
        </div>
      </div>
    </div>
  );
}
