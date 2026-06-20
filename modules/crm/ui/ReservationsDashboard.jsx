"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";
import ReservationForm from "./ReservationForm";

const STATUS_OPTIONS = ["예약접수", "픽업대기", "픽업완료", "취소"];

function formatAmount(amount) {
  if (typeof amount !== "number") return "-";
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthCells(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ReservationCalendar({ reservations, month, onPrev, onNext, onToday }) {
  const byDay = new Map();
  for (const reservation of reservations) {
    const key = dayKey(reservation.pickupAt);
    if (!key) continue;
    const list = byDay.get(key) ?? [];
    list.push(reservation);
    byDay.set(key, list);
  }
  const cells = buildMonthCells(month);
  const todayKey = dayKey(new Date());

  return (
    <div className="work-calendar">
      <div className="work-cal-nav">
        <button type="button" className="ghost-button" onClick={onPrev} aria-label="이전 달">◀</button>
        <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
        <button type="button" className="ghost-button" onClick={onNext} aria-label="다음 달">▶</button>
        <button type="button" className="ghost-button" onClick={onToday}>오늘</button>
      </div>
      <div className="work-cal-grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="work-cal-head">{weekday}</div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="work-cal-cell work-cal-empty" />;
          const key = dayKey(date);
          const list = byDay.get(key) ?? [];
          return (
            <div key={key} className={`work-cal-cell${key === todayKey ? " work-cal-today" : ""}`}>
              <div className="work-cal-day">{date.getDate()}</div>
              {list.slice(0, 3).map((reservation) => (
                <div
                  key={reservation.id}
                  className="work-cal-item"
                  title={`${reservation.customerName ?? ""} ${reservation.product} (${reservation.branchName ?? ""})`}
                >
                  {reservation.customerName ?? reservation.product}
                </div>
              ))}
              {list.length > 3 && <div className="work-cal-more">+{list.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightsPanel() {
  const [metrics, setMetrics] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await requestJson("/api/work/crm/metrics");
        if (!cancelled) {
          setMetrics(data);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return <p className="work-empty">불러오는 중...</p>;
  if (error) return <p className="action-error">{error}</p>;
  if (!metrics) return <p className="work-empty">데이터가 없습니다.</p>;

  const { total, byBranch, sourceMix } = metrics;
  const sourceTotal = sourceMix.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <div className="work-metric-grid">
        <div className="work-metric"><span>총 예약</span><strong>{total.count}</strong></div>
        <div className="work-metric"><span>총 매출</span><strong>{formatAmount(total.revenue)}</strong></div>
        <div className="work-metric"><span>고객 수</span><strong>{total.customers}</strong></div>
        <div className="work-metric"><span>재방문율</span><strong>{total.repeatRate}%</strong></div>
      </div>

      <h3>지점별</h3>
      {byBranch.length === 0 ? (
        <p className="work-empty">데이터가 없습니다.</p>
      ) : (
        <table className="work-table">
          <thead><tr><th>지점</th><th>예약 건수</th><th>매출</th></tr></thead>
          <tbody>
            {byBranch.map((row) => (
              <tr key={row.branchId}>
                <td>{row.branchName}</td>
                <td>{row.count}</td>
                <td>{formatAmount(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>예약 경로 비중</h3>
      {sourceMix.length === 0 ? (
        <p className="work-empty">데이터가 없습니다.</p>
      ) : (
        <table className="work-table">
          <thead><tr><th>경로</th><th>건수</th><th>비중</th></tr></thead>
          <tbody>
            {sourceMix.map((row) => (
              <tr key={row.source}>
                <td>{row.source}</td>
                <td>{row.count}</td>
                <td>{sourceTotal ? Math.round((row.count / sourceTotal) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function ReservationsDashboard({ initialNew = false, initialChannelId = null, initialBranchId = "", initialPrefill = null }) {
  const [reservations, setReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("list");
  const [calMonth, setCalMonth] = useState(() => new Date());

  const [showForm, setShowForm] = useState(initialNew);

  const loadReservations = useCallback(async () => {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (status) params.set("status", status);
    const queryString = params.toString();
    const data = await requestJson(`/api/work/crm/reservations${queryString ? `?${queryString}` : ""}`);
    setReservations(data.reservations ?? []);
    setBranches(data.branches ?? []);
  }, [branchId, status]);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    loadReservations()
      .then(() => {
        if (!cancelled) {
          setError("");
          setIsLoaded(true);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError.message);
          setIsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadReservations]);

  const totalAmount = reservations.reduce((sum, reservation) => sum + (reservation.amount ?? 0), 0);

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>예약 관리</h1>
          <p>전 지점 예약을 픽업일순으로 봅니다. 지점·상태로 필터링하거나 새 예약을 등록하세요.</p>
        </div>
        <div className="work-header-actions">
          <button type="button" className="ghost-button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "닫기" : "+ 새 예약"}
          </button>
          <Link className="ghost-button" href="/">← 채팅으로</Link>
        </div>
      </header>

      {showForm && (
        <ReservationForm
          branches={branches}
          fixedBranchId={initialBranchId}
          channelId={initialChannelId}
          prefill={initialPrefill}
          onSubmitted={() => {
            setShowForm(false);
            loadReservations();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <section className="work-section">
        <div className="work-filter-row">
          <label>
            지점
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">전체 지점</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">전체 상태</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="work-header-actions">
          <button type="button" className="ghost-button" aria-pressed={view === "list"} onClick={() => setView("list")}>목록</button>
          <button type="button" className="ghost-button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>캘린더</button>
          <button type="button" className="ghost-button" aria-pressed={view === "insights"} onClick={() => setView("insights")}>인사이트</button>
        </div>
        {error && <p className="action-error">{error}</p>}
      </section>

      <div className="work-metric-grid">
        <div className="work-metric">
          <span>예약 건수</span>
          <strong>{reservations.length}</strong>
        </div>
        <div className="work-metric">
          <span>합계 금액</span>
          <strong>{formatAmount(totalAmount)}</strong>
        </div>
      </div>

      <section className="work-section">
        {!isLoaded ? (
          <p className="work-empty">불러오는 중...</p>
        ) : view === "insights" ? (
          <InsightsPanel />
        ) : view === "calendar" ? (
          <ReservationCalendar
            reservations={reservations}
            month={calMonth}
            onPrev={() => setCalMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            onNext={() => setCalMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            onToday={() => setCalMonth(new Date())}
          />
        ) : reservations.length === 0 ? (
          <p className="work-empty">조건에 맞는 예약이 없습니다.</p>
        ) : (
          <table className="work-table">
            <thead>
              <tr>
                <th>픽업일</th>
                <th>고객</th>
                <th>지점</th>
                <th>상품</th>
                <th>금액</th>
                <th>경로</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{formatDate(reservation.pickupAt)}</td>
                  <td>{reservation.customerName ?? "-"}</td>
                  <td>{reservation.branchName ?? "-"}</td>
                  <td>{reservation.product}</td>
                  <td>{formatAmount(reservation.amount)}</td>
                  <td>{reservation.source}</td>
                  <td>{reservation.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
