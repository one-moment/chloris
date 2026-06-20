"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/core/apiClient";

const SOURCE_OPTIONS = ["인스타", "네이버플레이스", "네이버톡톡", "네이버검색", "매장방문", "전화예약", "지인"];
const RECEIVE_OPTIONS = ["방문수령", "퀵"];

function emptyForm(branchId) {
  return {
    name: "",
    phone: "",
    branchId: branchId ?? "",
    reservedAt: "",
    pickupAt: "",
    product: "",
    amount: "",
    source: "",
    receiveMethod: "",
    note: ""
  };
}

// 3단계: 헤르메스 미리채움(비PII만) 초기값 반영. 성함·연락처(name/phone)는 절대 미리채우지 않는다.
function applyPrefill(base, prefill) {
  if (!prefill || typeof prefill !== "object") return base;
  const next = { ...base };
  if (prefill.product) next.product = String(prefill.product);
  if (prefill.amount) next.amount = String(prefill.amount);
  if (prefill.pickup) next.pickupAt = String(prefill.pickup).slice(0, 16);
  if (prefill.receive && RECEIVE_OPTIONS.includes(prefill.receive)) next.receiveMethod = prefill.receive;
  if (prefill.source && SOURCE_OPTIONS.includes(prefill.source)) next.source = prefill.source;
  return next;
}

function formatPickup(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// 재사용 예약 입력 폼. /work/reservations "새 예약"과 (후속) #지점방 @예약 진입이 공유한다.
// fixedBranchId 주면 지점 고정(현장 진입), 없으면 지점 선택(매니저 진입). channelId는 예약-채널 연결용.
export default function ReservationForm({ branches = [], fixedBranchId = "", channelId = null, prefill = null, onSubmitted, onCancel }) {
  const [form, setForm] = useState(() => applyPrefill(emptyForm(fixedBranchId), prefill));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const q = (form.phone || form.name).trim();
    if (q.length < 2) {
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
  }, [form.phone, form.name]);

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
      const data = await requestJson("/api/work/crm/reservations", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          branchId: fixedBranchId || form.branchId,
          reservedAt: form.reservedAt || undefined,
          pickupAt: form.pickupAt,
          product: form.product,
          amount: Number(form.amount),
          source: form.source,
          receiveMethod: form.receiveMethod,
          note: form.note || undefined,
          channelId: channelId || undefined
        })
      });
      if (channelId) {
        // #지점방 진입(@예약 v1): 제출 후 채널에 요약 카드 게시. bot:true → 에이전트/봇 재처리 안 함.
        // 베스트-에포트: 게시 실패해도 예약은 이미 생성됨.
        const summary = `📋 예약 접수 — ${form.name} · ${form.product} · 픽업 ${formatPickup(form.pickupAt)} · ₩${Number(form.amount).toLocaleString("ko-KR")}`;
        try {
          await requestJson(`/api/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({ body: summary, bot: true })
          });
        } catch {
          /* 요약 게시 실패 무시 */
        }
      }
      setForm(emptyForm(fixedBranchId));
      setMatches([]);
      onSubmitted?.(data.reservation);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fixedBranchName = fixedBranchId
    ? (branches.find((branch) => branch.id === fixedBranchId)?.name ?? fixedBranchId)
    : null;

  return (
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
        {fixedBranchId ? (
          <label>
            지점
            <input value={fixedBranchName} readOnly />
          </label>
        ) : (
          <label>
            지점
            <select value={form.branchId} onChange={(event) => updateField("branchId", event.target.value)} required>
              <option value="">선택</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
        )}
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
        {onCancel && (
          <button type="button" className="ghost-button" onClick={onCancel}>닫기</button>
        )}
      </div>
    </form>
  );
}
