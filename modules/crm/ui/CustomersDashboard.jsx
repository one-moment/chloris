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

const EMPTY_FORM = { name: "", phone: "", homeBranchId: "", memo: "" };

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

function CustomerForm({ branches, initial, submitLabel, submitting, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="work-filter-row">
        <label>
          성함
          <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
        </label>
        <label>
          연락처
          <input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="010-0000-0000" required />
        </label>
        <label>
          홈지점
          <select value={form.homeBranchId} onChange={(event) => update("homeBranchId", event.target.value)}>
            <option value="">(없음)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>
        <label>
          메모
          <input value={form.memo} onChange={(event) => update("memo", event.target.value)} />
        </label>
      </div>
      {error && <p className="action-error">{error}</p>}
      <div className="work-header-actions">
        <button type="submit" className="ghost-button" disabled={submitting}>
          {submitting ? "저장 중..." : submitLabel}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

export default function CustomersDashboard() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  // formMode: null | "create" | <customerId being edited>
  const [formMode, setFormMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await requestJson("/api/work/crm/reservations");
        if (!cancelled) setBranches(data.branches ?? []);
      } catch {
        /* 지점 목록은 보조 정보 — 실패 시 빈 목록으로 degrade */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [query, refreshTick]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  async function handleCreate(form) {
    setSubmitting(true);
    setFormError("");
    try {
      const data = await requestJson("/api/work/crm/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          homeBranchId: form.homeBranchId || undefined,
          memo: form.memo || undefined
        })
      });
      setFormMode(null);
      setQuery(data.customer?.phone ?? form.phone);
    } catch (createError) {
      setFormError(createError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(form) {
    setSubmitting(true);
    setFormError("");
    try {
      await requestJson(`/api/work/crm/customers/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          homeBranchId: form.homeBranchId,
          memo: form.memo
        })
      });
      setFormMode(null);
      setRefreshTick((tick) => tick + 1);
    } catch (editError) {
      setFormError(editError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreate() {
    setFormError("");
    setFormMode((mode) => (mode === "create" ? null : "create"));
  }

  function openEdit() {
    setFormError("");
    setFormMode(selectedId);
  }

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>고객 관리</h1>
          <p>전 지점 공통 고객을 이름·전화번호로 조회·등록·수정하고 주문이력을 봅니다.</p>
        </div>
        <div className="work-header-actions">
          <button type="button" className="ghost-button" onClick={openCreate}>
            {formMode === "create" ? "닫기" : "+ 새 고객"}
          </button>
          <Link className="ghost-button" href="/">← 채팅으로</Link>
        </div>
      </header>

      {formMode === "create" && (
        <section className="work-section">
          <h2>새 고객 등록</h2>
          <CustomerForm
            key="create"
            branches={branches}
            initial={EMPTY_FORM}
            submitLabel="고객 등록"
            submitting={submitting}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => {
              setFormMode(null);
              setFormError("");
            }}
          />
        </section>
      )}

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
          <div className="work-header-actions">
            <h2>{selected.name} 님</h2>
            {formMode !== selected.id && (
              <button type="button" className="ghost-button" onClick={openEdit}>수정</button>
            )}
          </div>

          {formMode === selected.id ? (
            <CustomerForm
              key={selected.id}
              branches={branches}
              initial={{
                name: selected.name,
                phone: selected.phone,
                homeBranchId: selected.homeBranchId ?? "",
                memo: selected.memo ?? ""
              }}
              submitLabel="저장"
              submitting={submitting}
              error={formError}
              onSubmit={handleEdit}
              onCancel={() => {
                setFormMode(null);
                setFormError("");
              }}
            />
          ) : (
            <>
              {selected.memo && <p>{selected.memo}</p>}
              <h3>최근 예약</h3>
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
            </>
          )}
        </section>
      )}
    </div>
  );
}
