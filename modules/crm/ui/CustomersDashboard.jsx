"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

const RESERVATION_STATUS_LABELS = {
  예약접수: "예약접수",
  픽업대기: "픽업대기",
  픽업완료: "픽업완료",
  취소: "취소"
};

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

export default function CustomersDashboard() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setCustomers([]);
      setSelectedId(null);
      setError("");
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await requestJson(`/api/work/crm/customers?q=${encodeURIComponent(trimmed)}`);
        if (cancelled) return;
        setCustomers(data.customers ?? []);
        setError("");
      } catch (searchError) {
        if (!cancelled) setError(searchError.message);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>고객 관리</h1>
          <p>전 지점 공통 고객을 이름·전화번호로 조회하고 주문이력을 봅니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 전화번호로 검색"
          aria-label="고객 검색"
        />
        {error && <p className="action-error">{error}</p>}
      </section>

      <section className="work-section">
        {!query.trim() ? (
          <p className="work-empty">이름이나 전화번호를 입력하면 고객과 예약 이력이 표시됩니다.</p>
        ) : isSearching ? (
          <p className="work-empty">검색 중...</p>
        ) : customers.length === 0 ? (
          <p className="work-empty">일치하는 고객이 없습니다.</p>
        ) : (
          <ul className="work-list">
            {customers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className="work-list-row"
                  aria-expanded={customer.id === selectedId}
                  onClick={() => setSelectedId(customer.id === selectedId ? null : customer.id)}
                >
                  <span>
                    <strong>{customer.name}</strong>
                    {customer.reservationCount >= 2 && <span className="work-badge">단골</span>}
                  </span>
                  <span className="work-mono">{customer.phone}</span>
                  <span>예약 {customer.reservationCount}건 · {formatAmount(customer.totalAmount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="work-section">
          <h2>{selected.name} 님 최근 예약</h2>
          {selected.memo && <p>{selected.memo}</p>}
          {selected.recentReservations.length === 0 ? (
            <p className="work-empty">예약 이력이 없습니다.</p>
          ) : (
            <table className="work-table">
              <thead>
                <tr>
                  <th>픽업일</th>
                  <th>상품</th>
                  <th>금액</th>
                  <th>경로</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {selected.recentReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{formatDate(reservation.pickupAt)}</td>
                    <td>{reservation.product}</td>
                    <td>{formatAmount(reservation.amount)}</td>
                    <td>{reservation.source}</td>
                    <td>{RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
