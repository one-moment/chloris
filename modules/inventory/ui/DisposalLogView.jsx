"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/core/apiClient";
import AttachmentList from "../../../components/AttachmentList";
import { DISPOSAL_STATUS_LABELS } from "../../../lib/inventory";

// 전 직원 폐기 조회뷰 (2순위). 검수대기·승인완료·반려 세 상태를 폐기관리 페이지 안에서 조회한다.
// 운영 교육(어떻게 입력하면 승인/반려되는지)·분석용. draft(임시저장)는 제외 — 서버에 review,submitted,rejected만 요청.
// 기존 GET(/api/work/inventory/disposals)을 status CSV·item 파라미터로 소비 — 새 API 없음.

const TABS = [
  { key: "all", label: "전체", statuses: "review,submitted,rejected" },
  { key: "review", label: "검수대기", statuses: "review" },
  { key: "submitted", label: "승인완료", statuses: "submitted" },
  { key: "rejected", label: "반려", statuses: "rejected" }
];

// 색상 배지는 batch.status에서 파생한다(상태를 복사 저장하지 않음 → 전환 시 어긋남 방지).
const STATUS_BADGE = {
  review: { bg: "#fef3c7", fg: "#92400e" },     // 검수대기 노랑
  submitted: { bg: "#dcfce7", fg: "#166534" },  // 승인완료 초록
  rejected: { bg: "#fee2e2", fg: "#991b1b" }    // 반려 빨강
};

function StatusBadge({ status }) {
  const color = STATUS_BADGE[status] ?? { bg: "var(--line, #e5e7eb)", fg: "var(--muted, #555)" };
  return (
    <span style={{ background: color.bg, color: color.fg, borderRadius: "6px", padding: "2px 8px", fontSize: "12px", fontWeight: 600 }}>
      {DISPOSAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// "YYYY-MM" → { from: 월초, to: 월말 }. 월 선택 시 날짜 범위로 환산(새 파라미터 없이 기존 from/to 재사용).
function monthRange(month) {
  if (!month) return null;
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) return null;
  const last = new Date(year, mon, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default function DisposalLogView() {
  const [tab, setTab] = useState("all");
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 품목 검색 디바운스(타이핑마다 호출 방지).
  useEffect(() => {
    const timer = setTimeout(() => setItemQuery(itemInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [itemInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const statuses = TABS.find((entry) => entry.key === tab)?.statuses ?? "review,submitted,rejected";
        const query = new URLSearchParams();
        query.set("status", statuses);
        if (branchId) query.set("branchId", branchId);
        const range = monthRange(month);
        const effFrom = range ? range.from : from;
        const effTo = range ? range.to : to;
        if (effFrom) query.set("from", effFrom);
        if (effTo) query.set("to", effTo);
        if (itemQuery) query.set("item", itemQuery);
        const data = await requestJson(`/api/work/inventory/disposals?${query.toString()}`);
        if (cancelled) return;
        setBatches(data.batches ?? []);
        if ((data.branches ?? []).length) setBranches(data.branches);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, branchId, month, from, to, itemQuery]);

  const monthActive = Boolean(monthRange(month));

  return (
    <section className="work-section">
      <h2>폐기 조회</h2>
      <p className="work-empty" style={{ marginTop: 0 }}>
        검수대기·승인완료·반려 기록을 전 직원이 조회합니다(임시저장 제외). 어떻게 입력하면 승인되는지·어떤 사유로 반려되는지 참고용.
      </p>

      <div className="work-filter-row" role="tablist" aria-label="폐기 상태 탭" style={{ gap: "6px" }}>
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={tab === entry.key ? "primary-button" : "ghost-button"}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="work-filter-row" style={{ marginTop: "8px" }}>
        <label>지점{" "}
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="지점 필터">
            <option value="">전체</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>월{" "}
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="월 필터" />
        </label>
        <label>시작{" "}
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={monthActive} aria-label="시작일" />
        </label>
        <label>종료{" "}
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={monthActive} aria-label="종료일" />
        </label>
        <label>품목{" "}
          <input value={itemInput} onChange={(event) => setItemInput(event.target.value)} placeholder="품목 검색" aria-label="품목 검색" />
        </label>
      </div>

      {error && <p className="action-error">{error}</p>}
      {loading ? (
        <p className="work-empty">불러오는 중…</p>
      ) : batches.length === 0 ? (
        <p className="work-empty">조회된 폐기 기록이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
          {batches.map((batch) => {
            const branchName = branches.find((branch) => branch.id === batch.branchId)?.name ?? batch.branchId;
            const dateStr = batch.disposalDate ? String(batch.disposalDate).slice(0, 10) : "";
            const approvedAtStr = batch.approvedAt ? String(batch.approvedAt).slice(0, 10) : "";
            return (
              <li key={batch.id} style={{ border: "1px solid var(--line, #dfe4e8)", borderRadius: "8px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                  <strong>{branchName} · {dateStr}</strong>
                  <StatusBadge status={batch.status} />
                </div>
                <div style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0" }}>
                  입력자 {batch.createdByName ?? "—"}
                  {batch.approvedByName ? ` · 승인 ${batch.approvedByName}` : ""}
                  {approvedAtStr ? ` (${approvedAtStr})` : ""}
                  {batch.rejectReason ? ` · 반려사유: ${batch.rejectReason}` : ""}
                </div>
                <ul style={{ margin: "4px 0", paddingLeft: "18px", fontSize: "13px" }}>
                  {batch.lines.map((line) => (
                    <li key={line.id}>
                      {line.itemName} {line.quantity}{line.unit} / {line.cause}{" "}
                      <span style={{ color: "var(--muted)" }}>({line.category})</span>
                    </li>
                  ))}
                </ul>
                {batch.attachments?.length > 0 && <AttachmentList attachments={batch.attachments} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
