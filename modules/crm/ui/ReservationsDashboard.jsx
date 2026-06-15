"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

const STATUS_OPTIONS = ["예약접수", "픽업대기", "픽업완료", "취소"];
const SOURCE_OPTIONS = ["인스타", "네이버플레이스", "네이버톡톡", "네이버검색", "매장방문", "전화예약", "지인"];
const RECEIVE_OPTIONS = ["방문수령", "퀵"];

const EMPTY_FORM = {
  name: "",
  phone: "",
  branchId: "",
  reservedAt: "",
  pickupAt: "",
  product: "",
  amount: "",
  source: "",
  receiveMethod: "",
  note: ""
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

export default function ReservationsDashboard() {
  const [reservations, setReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [matches, setMatches] = useState([]);

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

  useEffect(() => {
    const q = (form.phone || form.name).trim();
    if (!showForm || q.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await requestJson(`/api/work/crm/customers?q=${encodeURIComponent(q)}`);
        if (!cancelled) setMatches(data.customers ?? []);
      } catch {
        if (!cancelled) setMatches([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.phone, form.name, showForm]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyCustomer(customer) {
    setForm((prev) => ({ ...prev, name: customer.name, phone: customer.phone }));
    setMatches([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await requestJson("/api/work/crm/reservations", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          branchId: form.branchId,
          reservedAt: form.reservedAt || undefined,
          pickupAt: form.pickupAt,
          product: form.product,
          amount: Number(form.amount),
          source: form.source,
          receiveMethod: form.receiveMethod,
          note: form.note || undefined
        })
      });
      setForm(EMPTY_FORM);
      setMatches([]);
      setShowForm(false);
      await loadReservations();
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

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
        <form className="work-section" onSubmit={handleSubmit}>
          <h2>새 예약</h2>
          <div className="work-filter-row">
            <label>
              성함
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
            </label>
            <label>
              연락처
              <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="010-0000-0000" required />
            </label>
            <label>
              지점
              <select value={form.branchId} onChange={(event) => updateField("branchId", event.target.value)} required>
                <option value="">선택</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
          </div>

          {matches.length > 0 && (
            <p className="work-empty">
              기존 고객:{" "}
              {matches.map((customer) => (
                <button key={customer.id} type="button" className="ghost-button" onClick={() => applyCustomer(customer)}>
                  {customer.name} {customer.phone} ({customer.reservationCount}건)
                </button>
              ))}
            </p>
          )}

          <div className="work-filter-row">
            <label>
              예약일
              <input type="date" value={form.reservedAt} onChange={(event) => updateField("reservedAt", event.target.value)} />
            </label>
            <label>
              픽업 일시
              <input type="datetime-local" value={form.pickupAt} onChange={(event) => updateField("pickupAt", event.target.value)} required />
            </label>
            <label>
              상품
              <input value={form.product} onChange={(event) => updateField("product", event.target.value)} required />
            </label>
            <label>
              금액
              <input type="number" min="0" value={form.amount} onChange={(event) => updateField("amount", event.target.value)} required />
            </label>
          </div>

          <div className="work-filter-row">
            <label>
              예약 경로
              <select value={form.source} onChange={(event) => updateField("source", event.target.value)} required>
                <option value="">선택</option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              수령 방법
              <select value={form.receiveMethod} onChange={(event) => updateField("receiveMethod", event.target.value)} required>
                <option value="">선택</option>
                {RECEIVE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              비고
              <input value={form.note} onChange={(event) => updateField("note", event.target.value)} />
            </label>
          </div>

          {formError && <p className="action-error">{formError}</p>}
          <div className="work-header-actions">
            <button type="submit" className="ghost-button" disabled={submitting}>
              {submitting ? "저장 중..." : "예약 저장"}
            </button>
          </div>
        </form>
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
