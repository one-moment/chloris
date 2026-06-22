"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

// 재고 인사이트 (지점 인사이트). /api/work/inventory/metrics 를 기간·지점·단위 필터로 소비한다.
// 최종제출(submitted) 기록만 집계. 폐기율=가액 기준. 차트는 무의존성 인라인 SVG로 직접 그린다
// (새 의존성 금지, 모듈 경계상 다른 모듈 import 금지). 설계: docs/inventory-stockin-disposal.md §11

const GRANULARITY_OPTIONS = [
  { value: "day", label: "일" },
  { value: "week", label: "주" },
  { value: "month", label: "월" }
];

// 지점별 추이 시리즈 색(고정 팔레트). 보로 그린 → 대비색 순.
const SERIES_COLORS = ["#185640", "#C0392B", "#2E86C1", "#B7950B", "#7D3C98", "#117A65"];

function won(value) {
  return `${(value ?? 0).toLocaleString("ko-KR")}원`;
}

function ratioPct(amount, total) {
  if (!total) return 0;
  return Math.round((amount / total) * 1000) / 10;
}

function bucketLabel(bucket, granularity) {
  if (!bucket) return "";
  return granularity === "month" ? bucket.slice(0, 7) : bucket.slice(5); // YYYY-MM / MM-DD
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{ background: "var(--color-background-secondary, #f5f5f0)", borderRadius: "10px", padding: "12px 14px", minWidth: "140px", flex: "1 1 140px" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 500 }}>{value}</div>
      {hint && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{hint}</div>}
    </div>
  );
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

// 추이 응답(버킷별 + 지점별)을 차트가 그리기 좋은 시리즈로 피벗한다.
// 지점 선택 시 단일 시리즈(폐기율), "전체"면 지점마다 시리즈 1개.
function buildSeries(trend, branchId) {
  const points = trend?.points ?? [];
  if (points.length === 0) return { buckets: [], series: [] };
  const buckets = points.map((point) => point.bucket);

  if (branchId) {
    return {
      buckets,
      series: [{
        key: branchId,
        name: "폐기율",
        values: points.map((point) => ({ wasteRate: point.wasteRate, disposalAmount: point.disposalAmount, stockInAmount: point.stockInAmount }))
      }]
    };
  }

  const branchName = new Map();
  for (const point of points) {
    for (const branch of point.branches ?? []) {
      if (!branchName.has(branch.branchId)) branchName.set(branch.branchId, branch.branchName);
    }
  }
  const series = [...branchName.entries()].map(([id, name]) => ({
    key: id,
    name,
    values: points.map((point) => {
      const found = (point.branches ?? []).find((branch) => branch.branchId === id);
      return found
        ? { wasteRate: found.wasteRate, disposalAmount: found.disposalAmount, stockInAmount: found.stockInAmount }
        : { wasteRate: 0, disposalAmount: 0, stockInAmount: 0 };
    })
  }));
  return { buckets, series };
}

// 무의존성 인라인 SVG 멀티시리즈 추이 차트. y=폐기율(%), x=버킷.
function WasteTrendChart({ trend, branchId, granularity }) {
  const { buckets, series } = buildSeries(trend, branchId);
  const hasData = buckets.length > 0 && series.some((s) => s.values.some((v) => v.stockInAmount > 0 || v.disposalAmount > 0));
  if (!hasData) return <p className="work-empty">표시할 추이 데이터가 없습니다.</p>;

  const width = 760;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const count = buckets.length;
  const maxWaste = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.wasteRate)));
  const niceMax = Math.max(5, Math.ceil(maxWaste / 5) * 5); // 5% 단위 올림

  const xAt = (index) => pad.left + (count === 1 ? innerW / 2 : (innerW * index) / (count - 1));
  const yAt = (value) => pad.top + innerH - (innerH * value) / niceMax;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(niceMax * fraction * 10) / 10);
  const labelIndexes = count <= 1 ? [0] : [0, Math.floor((count - 1) / 2), count - 1];
  const showDots = count <= 31;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="폐기율 추이 차트" style={{ width: "100%", height: "auto" }}>
      {yTicks.map((value) => (
        <g key={value}>
          <line x1={pad.left} y1={yAt(value)} x2={width - pad.right} y2={yAt(value)} stroke="var(--accent-weak)" strokeWidth="1" />
          <text x={pad.left - 8} y={yAt(value) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{value}%</text>
        </g>
      ))}

      {series.map((s, seriesIndex) => {
        const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
        const line = s.values.map((value, index) => `${xAt(index)},${yAt(value.wasteRate)}`).join(" ");
        return (
          <g key={s.key}>
            <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {showDots && s.values.map((value, index) => (
              <circle key={buckets[index]} cx={xAt(index)} cy={yAt(value.wasteRate)} r="2.5" fill={color}>
                <title>{`${bucketLabel(buckets[index], granularity)} · ${s.name} · 폐기율 ${value.wasteRate}% · 폐기 ${won(value.disposalAmount)} · 입고 ${won(value.stockInAmount)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {labelIndexes.map((index) => (
        <text key={index} x={xAt(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {bucketLabel(buckets[index], granularity)}
        </text>
      ))}
    </svg>
  );
}

function ChartLegend({ trend, branchId }) {
  const { series } = buildSeries(trend, branchId);
  if (series.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
      {series.map((s, index) => (
        <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--muted)" }}>
          <span style={{ width: "14px", height: "0", borderTop: `2px solid ${SERIES_COLORS[index % SERIES_COLORS.length]}` }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export default function InventoryInsightsDashboard() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState("month");
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await requestJson("/api/work/inventory/disposals?status=__none__");
        if (!cancelled) setBranches(data.branches ?? []);
      } catch {
        /* 지점 목록 실패는 무시(전체 집계로 동작) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const query = new URLSearchParams();
        if (branchId) query.set("branchId", branchId);
        if (from) query.set("from", from);
        if (to) query.set("to", to);
        query.set("granularity", granularity);
        const data = await requestJson(`/api/work/inventory/metrics?${query.toString()}`);
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
  }, [branchId, from, to, granularity]);

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>재고 인사이트</h1>
          <p>최종제출된 폐기·입고 기록으로 폐기율·추이·품목별·사유 비중을 집계합니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section work-filter-row">
        <label>
          지점{" "}
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="지점">
            <option value="">전체</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>시작{" "}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="시작일" /></label>
        <label>종료{" "}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="종료일" /></label>
      </section>

      {error && <p className="action-error">{error}</p>}

      {loading || !metrics ? (
        <section className="work-section"><p className="work-empty">불러오는 중...</p></section>
      ) : (
        <>
          <section className="work-section" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <StatCard label="폐기율(가액)" value={`${metrics.wasteRateByAmount}%`} hint="폐기가액 / 입고가액" />
            <StatCard label="폐기가액" value={won(metrics.disposal.totalAmount)} hint={`${metrics.disposal.lineCount}건`} />
            <StatCard label="입고가액" value={won(metrics.stockIn.totalAmount)} hint={`${metrics.stockIn.lineCount}건`} />
            <StatCard label="입고 불일치율" value={`${metrics.stockIn.discrepancyRate}%`} hint={`${metrics.stockIn.discrepancyCount}건`} />
          </section>

          <section className="work-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
              <h2>폐기율 추이</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>단위</span>
                <ToggleGroup value={granularity} options={GRANULARITY_OPTIONS} onChange={setGranularity} ariaLabel="집계 단위" />
              </div>
            </div>
            <WasteTrendChart trend={metrics.trend} branchId={branchId} granularity={granularity} />
            <div style={{ marginTop: "8px" }}>
              <ChartLegend trend={metrics.trend} branchId={branchId} />
            </div>
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px" }}>
              폐기율 = 폐기가액 ÷ 입고가액. {branchId ? "선택 지점의 추이" : "지점별 추이 비교(전체)"} · 주 기준 월요일~일요일.
            </p>
          </section>

          <section className="work-section">
            <h2>폐기 사유 비중</h2>
            {metrics.disposal.byCause.length === 0 ? (
              <p className="work-empty">집계할 폐기 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>사유</th><th>폐기가액</th><th>비중</th></tr></thead>
                <tbody>
                  {metrics.disposal.byCause.map((row) => (
                    <tr key={row.cause}>
                      <td>{row.cause}</td>
                      <td>{won(row.amount)}</td>
                      <td>{ratioPct(row.amount, metrics.disposal.totalAmount)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="work-section">
            <h2>품목별 폐기</h2>
            {(metrics.disposal.byItem ?? []).length === 0 ? (
              <p className="work-empty">집계할 폐기 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>품목</th><th>폐기량</th><th>폐기가액</th></tr></thead>
                <tbody>
                  {metrics.disposal.byItem.map((row) => (
                    <tr key={row.itemName}>
                      <td>{row.itemName || "-"}</td>
                      <td>{(row.quantity ?? 0).toLocaleString("ko-KR")}</td>
                      <td>{won(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="work-section">
            <h2>구분별 폐기</h2>
            {(metrics.disposal.byCategory ?? []).length === 0 ? (
              <p className="work-empty">집계할 폐기 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>구분</th><th>건수</th><th>폐기가액</th><th>비중</th></tr></thead>
                <tbody>
                  {metrics.disposal.byCategory.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category || "-"}</td>
                      <td>{row.count}</td>
                      <td>{won(row.amount)}</td>
                      <td>{ratioPct(row.amount, metrics.disposal.totalAmount)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="work-section">
            <h2>지점별</h2>
            {metrics.byBranch.length === 0 ? (
              <p className="work-empty">집계할 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>지점</th><th>폐기가액</th><th>입고가액</th><th>폐기율</th><th>불일치</th></tr></thead>
                <tbody>
                  {metrics.byBranch.map((row) => (
                    <tr key={row.branchId}>
                      <td>{row.branchName}</td>
                      <td>{won(row.disposalAmount)}</td>
                      <td>{won(row.stockInAmount)}</td>
                      <td>{row.wasteRate}%</td>
                      <td>{row.discrepancyCount}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
