"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

// 매출 대시보드 (원모먼트 통계 모듈). /api/work/analytics/metrics 를 기간·단위로 소비한다.
// ⚠️ Phase 0: 더미 데이터. 응답 형태(계약)는 고정, Phase 1에서 출처만 RDS로 교체.
// 모듈 규칙: lib/(core·platform)만 import. 차트는 무의존성 인라인 SVG로 직접 그린다(새 의존성 금지).

const PERIOD_OPTIONS = [
  { value: "this-month", label: "이번 달" },
  { value: "last-30", label: "최근 30일" },
  { value: "custom", label: "사용자 지정" }
];

const GRANULARITY_OPTIONS = [
  { value: "day", label: "일" },
  { value: "week", label: "주" },
  { value: "month", label: "월" }
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function fmtLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function presetRange(preset) {
  const today = todayLocal();
  if (preset === "last-30") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { from: fmtLocal(start), to: fmtLocal(today) };
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: fmtLocal(first), to: fmtLocal(today) };
}

function won(value) {
  return `${(value ?? 0).toLocaleString("ko-KR")}원`;
}

// 축 라벨용 압축 통화 표기(165만 / 1.2억).
function compactWon(value) {
  const v = value ?? 0;
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  return v.toLocaleString("ko-KR");
}

function pctChange(current, previous) {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function xLabel(dateStr, granularity) {
  return granularity === "month" ? dateStr.slice(0, 7) : dateStr.slice(5);
}

function ToggleGroup({ value, options, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "inline-flex", gap: "4px" }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            style={{
              padding: "4px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: "pointer",
              border: active ? "1px solid var(--accent)" : "1px solid var(--accent-weak)",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--muted)"
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint, change }) {
  const hasChange = change != null && Number.isFinite(change);
  return (
    <div style={{ background: "var(--color-background-secondary, #f5f5f0)", borderRadius: "10px", padding: "12px 14px", minWidth: "150px", flex: "1 1 150px" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 500, marginTop: "2px" }}>{value}</div>
      {hint && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{hint}</div>}
      {hasChange && (
        <div style={{ fontSize: "11px", marginTop: "2px", color: change >= 0 ? "var(--accent)" : "#c0392b" }}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% <span style={{ color: "var(--muted)" }}>직전 대비</span>
        </div>
      )}
    </div>
  );
}

// 무의존성 인라인 SVG 추세 차트. 매출(영역+선) + 광고비(점선) 한 축.
function TrendChart({ series, granularity }) {
  if (!series || series.length === 0) {
    return <p className="work-empty">표시할 데이터가 없습니다.</p>;
  }

  const width = 760;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 36, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const count = series.length;
  const maxValue = Math.max(...series.map((point) => point.revenue), 1);

  const xAt = (index) => pad.left + (count === 1 ? innerW / 2 : (innerW * index) / (count - 1));
  const yAt = (value) => pad.top + innerH - (innerH * value) / maxValue;

  const revenueLine = series.map((point, index) => `${xAt(index)},${yAt(point.revenue)}`).join(" ");
  const adSpendLine = series.map((point, index) => `${xAt(index)},${yAt(point.adSpend)}`).join(" ");
  const areaPath = `${pad.left},${pad.top + innerH} ${revenueLine} ${xAt(count - 1)},${pad.top + innerH}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => maxValue * fraction);
  const labelIndexes = count <= 1 ? [0] : [0, Math.floor((count - 1) / 2), count - 1];
  const showDots = count <= 31;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="매출·광고비 추세 차트" style={{ width: "100%", height: "auto" }}>
      {yTicks.map((value) => (
        <g key={value}>
          <line x1={pad.left} y1={yAt(value)} x2={width - pad.right} y2={yAt(value)} stroke="var(--accent-weak)" strokeWidth="1" />
          <text x={pad.left - 8} y={yAt(value) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{compactWon(value)}</text>
        </g>
      ))}

      <polygon points={areaPath} fill="var(--accent)" opacity="0.10" />
      <polyline points={revenueLine} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={adSpendLine} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />

      {showDots && series.map((point, index) => (
        <circle key={point.date} cx={xAt(index)} cy={yAt(point.revenue)} r="2.5" fill="var(--accent)">
          <title>{`${point.date} · 매출 ${won(point.revenue)} · 광고비 ${won(point.adSpend)}`}</title>
        </circle>
      ))}

      {labelIndexes.map((index) => (
        <text key={index} x={xAt(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {xLabel(series[index].date, granularity)}
        </text>
      ))}
    </svg>
  );
}

function LegendDot({ color, dashed, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--muted)" }}>
      <span style={{ width: "14px", height: "0", borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} />
      {children}
    </span>
  );
}

export default function SalesDashboard() {
  const [preset, setPreset] = useState("this-month");
  const [range, setRange] = useState(() => presetRange("this-month"));
  const [granularity, setGranularity] = useState("day");
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function choosePreset(next) {
    setPreset(next);
    if (next !== "custom") setRange(presetRange(next));
  }

  function changeFrom(value) {
    setPreset("custom");
    setRange((prev) => ({ ...prev, from: value }));
  }

  function changeTo(value) {
    setPreset("custom");
    setRange((prev) => ({ ...prev, to: value }));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const query = new URLSearchParams({ from: range.from, to: range.to, granularity });
        const data = await requestJson(`/api/work/analytics/metrics?${query.toString()}`);
        if (cancelled) return;
        setMetrics(data);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, granularity]);

  const summary = metrics?.summary;
  const previous = metrics?.previous;

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>통계</h1>
          <p>매출·주문·광고 성과를 한눈에. 증감은 직전 동일 기간 대비입니다. (Phase 0 — 더미 데이터)</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section work-filter-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>기간</span>
          <ToggleGroup value={preset} options={PERIOD_OPTIONS} onChange={choosePreset} ariaLabel="기간 선택" />
        </div>
        {preset === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="date" value={range.from} max={range.to} onChange={(event) => changeFrom(event.target.value)} aria-label="시작일" />
            <span style={{ color: "var(--muted)" }}>~</span>
            <input type="date" value={range.to} min={range.from} onChange={(event) => changeTo(event.target.value)} aria-label="종료일" />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>단위</span>
          <ToggleGroup value={granularity} options={GRANULARITY_OPTIONS} onChange={setGranularity} ariaLabel="집계 단위" />
        </div>
      </section>

      {error && <p className="action-error">{error}</p>}

      {loading || !summary ? (
        <section className="work-section"><p className="work-empty">불러오는 중...</p></section>
      ) : (
        <>
          <section className="work-section" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <StatCard label="총매출" value={won(summary.revenue)} change={pctChange(summary.revenue, previous?.revenue)} />
            <StatCard label="총주문수" value={`${(summary.orders ?? 0).toLocaleString("ko-KR")}건`} change={pctChange(summary.orders, previous?.orders)} />
            <StatCard label="객단가(AOV)" value={won(summary.aov)} change={pctChange(summary.aov, previous?.aov)} />
            <StatCard label="총광고비" value={won(summary.adSpend)} hint={`출처: 수기 입력(${metrics.meta?.adSpendSource ?? "manual"})`} />
            <StatCard label="Blended ROAS" value={`${summary.roas}x`} hint="전체 매출 기준(blended)" change={pctChange(summary.roas, previous?.roas)} />
            <StatCard label="광고 의존도" value={`${summary.adCostRatio}%`} hint="광고비 ÷ 매출" />
          </section>

          <section className="work-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
              <h2>매출 추이</h2>
              <div style={{ display: "flex", gap: "14px" }}>
                <LegendDot color="var(--accent)">매출</LegendDot>
                <LegendDot color="var(--muted)" dashed>광고비</LegendDot>
              </div>
            </div>
            <TrendChart series={metrics.series} granularity={metrics.range?.granularity ?? granularity} />
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px" }}>
              · Blended ROAS = 전체 매출 ÷ 전체 광고비 (채널 귀속 아님). · 광고비 출처: 수기 입력({metrics.meta?.adSpendSource ?? "manual"}).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
