"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

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

export default function ReservationsDashboard() {
  const [reservations, setReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);

    async function load() {
      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);
        if (status) params.set("status", status);
        const queryString = params.toString();
        const data = await requestJson(`/api/work/crm/reservations${queryString ? `?${queryString}` : ""}`);
        if (cancelled) return;
        setReservations(data.reservations ?? []);
        setBranches(data.branches ?? []);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [branchId, status]);

  const totalAmount = reservations.reduce((sum, reservation) => sum + (reservation.amount ?? 0), 0);

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>예약 관리</h1>
          <p>전 지점 예약을 픽업일순으로 봅니다. 지점·상태로 필터링하세요.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

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
