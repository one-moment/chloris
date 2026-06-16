"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

// 재고 인사이트 (지점 인사이트). /api/work/inventory/metrics 를 기간·지점 필터로 소비한다.
// 최종제출 기록만 집계. 설계: docs/inventory-stockin-disposal.md §11

function won(value) {
  return `${(value ?? 0).toLocaleString("ko-KR")}원`;
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

// 월별 폐기율 추이 — 의존성 없는 인라인 SVG 라인 차트. data=[{month, wasteRate}].
function TrendChart({ data = [] }) {
  if (data.length === 0) return <p className="work-empty">집계할 기록이 없습니다.</p>;
  const width = 640;
  const height = 180;
  const padX = 36;
  const padY = 24;
  const max = Math.max(10, ...data.map((row) => row.wasteRate));
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const x = (index) => padX + stepX * index;
  const y = (value) => height - padY - (value / max) * (height - padY * 2);
  const points = data.map((row, index) => `${x(index)},${y(row.wasteRate)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="월별 폐기율 추이" style={{ width: "100%", maxWidth: `${width}px`, height: "auto" }}>
      <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--line, #dfe4e8)" />
      {data.length > 1 && <polyline fill="none" stroke="var(--accent, #0f766e)" strokeWidth="2" points={points} />}
      {data.map((row, index) => (
        <g key={row.month}>
          <circle cx={x(index)} cy={y(row.wasteRate)} r="3" fill="var(--accent, #0f766e)" />
          <text x={x(index)} y={y(row.wasteRate) - 7} textAnchor="middle" fontSize="10" fill="var(--text, #1f2933)">{row.wasteRate}%</text>
          <text x={x(index)} y={height - padY + 14} textAnchor="middle" fontSize="10" fill="var(--muted)">{row.month.length >= 7 ? row.month.slice(2) : row.month}</text>
        </g>
      ))}
    </svg>
  );
}

export default function InventoryInsightsDashboard() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
  }, [branchId, from, to]);

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>재고 인사이트</h1>
          <p>최종제출된 폐기·입고 기록으로 폐기율·사유 비중·입고 불일치율을 집계합니다.</p>
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
            <h2>폐기 사유 비중</h2>
            {metrics.disposal.byCause.length === 0 ? (
              <p className="work-empty">집계할 폐기 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>사유</th><th>건수</th><th>폐기가액</th></tr></thead>
                <tbody>
                  {metrics.disposal.byCause.map((row) => (
                    <tr key={row.cause}><td>{row.cause}</td><td>{row.count}</td><td>{won(row.amount)}</td></tr>
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

          <section className="work-section">
            <h2>폐기율 추이 (월별)</h2>
            <TrendChart data={metrics.byMonth ?? []} />
          </section>

          <section className="work-section">
            <h2>월별 입고·폐기가액</h2>
            {(metrics.byMonth ?? []).length === 0 ? (
              <p className="work-empty">집계할 기록이 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead><tr><th>월</th><th>입고가액</th><th>폐기가액</th><th>폐기율</th></tr></thead>
                <tbody>
                  {metrics.byMonth.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{won(row.stockInAmount)}</td>
                      <td>{won(row.disposalAmount)}</td>
                      <td>{row.wasteRate}%</td>
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
                <thead><tr><th>품목</th><th>건수</th><th>폐기량</th><th>폐기가액</th></tr></thead>
                <tbody>
                  {metrics.disposal.byItem.map((row) => (
                    <tr key={row.itemName}>
                      <td>{row.itemName}</td>
                      <td>{row.count}</td>
                      <td>{row.quantity}</td>
                      <td>{won(row.amount)}</td>
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
