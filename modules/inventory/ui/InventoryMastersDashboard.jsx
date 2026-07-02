"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

// 재고 마스터 관리 (관리자 전용). 품목 마스터 + 폐기원인 마스터 + 신규 품목 등록 요청 승인.
// 데이터는 /api/work/inventory/admin/* 와 /api/work/inventory/item-requests 를 호출한다.
// 설계: docs/inventory-stockin-disposal.md

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const EMPTY_ITEM_FORM = { name: "", category: "", origin: "", defaultUnit: "송이", isImported: false };

export default function InventoryMastersDashboard() {
  const [version, setVersion] = useState(0);
  const [items, setItems] = useState([]);
  const [causes, setCauses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [causeForm, setCauseForm] = useState({ name: "", sortOrder: 0 });

  // 품목 수정 모달: editTarget이 있으면 열림. 저장 실패 시 모달을 닫지 않고 editError로 표시.
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_ITEM_FORM);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [itemsRes, causesRes, requestsRes] = await Promise.all([
          requestJson("/api/work/inventory/admin/items?includeInactive=1"),
          requestJson("/api/work/inventory/admin/causes?includeInactive=1"),
          requestJson("/api/work/inventory/item-requests?status=pending")
        ]);
        if (cancelled) return;
        setItems(itemsRes.items ?? []);
        setCauses(causesRes.causes ?? []);
        setRequests(requestsRes.requests ?? []);
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
  }, [version]);

  const reload = () => setVersion((value) => value + 1);

  async function runAction(work) {
    setBusy(true);
    try {
      await work();
      setError("");
      reload();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event) {
    event.preventDefault();
    if (!itemForm.name.trim()) return;
    await runAction(async () => {
      await requestJson("/api/work/inventory/admin/items", { method: "POST", body: JSON.stringify(itemForm) });
      setItemForm(EMPTY_ITEM_FORM);
    });
  }

  async function addCause(event) {
    event.preventDefault();
    if (!causeForm.name.trim()) return;
    await runAction(async () => {
      await requestJson("/api/work/inventory/admin/causes", { method: "POST", body: JSON.stringify(causeForm) });
      setCauseForm({ name: "", sortOrder: 0 });
    });
  }

  const toggleItem = (item) => runAction(() => requestJson(`/api/work/inventory/admin/items/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: !item.isActive })
  }));

  function deleteItem(item) {
    if (!window.confirm("해당 품목을 삭제하시겠습니까?")) return;
    return runAction(() => requestJson(`/api/work/inventory/admin/items/${item.id}`, { method: "DELETE" }));
  }

  function openEditItem(item) {
    setEditTarget(item);
    setEditForm({
      name: item.name,
      category: item.category ?? "",
      origin: item.origin ?? "",
      defaultUnit: item.defaultUnit,
      isImported: Boolean(item.isImported)
    });
    setEditError("");
  }

  function closeEditItem() {
    setEditTarget(null);
    setEditError("");
  }

  async function saveEditItem(event) {
    event.preventDefault();
    if (!editTarget || !editForm.name.trim()) return;
    if (!window.confirm("이대로 수정하시겠습니까?")) return;
    setBusy(true);
    try {
      await requestJson(`/api/work/inventory/admin/items/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          origin: editForm.origin,
          defaultUnit: editForm.defaultUnit,
          isImported: editForm.isImported
        })
      });
      closeEditItem();
      reload();
    } catch (saveError) {
      setEditError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  const toggleCause = (cause) => runAction(() => requestJson(`/api/work/inventory/admin/causes/${cause.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: !cause.isActive })
  }));

  const decideRequest = (request, action) => runAction(() => requestJson(`/api/work/inventory/item-requests/${request.id}`, {
    method: "PATCH",
    body: JSON.stringify({ action })
  }));

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>재고 마스터</h1>
          <p>품목·폐기원인 목록을 관리하고, 현장의 신규 품목 등록 요청을 승인합니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      {error && <p className="action-error">{error}</p>}
      {loading ? (
        <section className="work-section"><p className="work-empty">불러오는 중...</p></section>
      ) : (
        <>
          {requests.length > 0 && (
            <section className="work-section">
              <h2>신규 품목 등록 요청 {requests.length}건</h2>
              <ul className="work-list">
                {requests.map((request) => (
                  <li key={request.id}>
                    <div className="work-list-row" aria-disabled={busy}>
                      <span><strong>{request.requestedName}</strong></span>
                      <span>{formatDate(request.createdAt)}</span>
                      <span>
                        <button type="button" className="primary-button" disabled={busy} onClick={() => decideRequest(request, "approve")}>승인</button>
                        {" "}
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => decideRequest(request, "reject")}>반려</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="work-section">
            <h2>품목 마스터 ({items.length})</h2>
            <form className="work-filter-row" onSubmit={addItem}>
              <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="품목명 예: 소국(화이트)" aria-label="품목명" />
              <input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="분류(선택)" aria-label="분류" />
              <input value={itemForm.origin} onChange={(e) => setItemForm({ ...itemForm, origin: e.target.value })} placeholder="원산지(선택)" aria-label="원산지" />
              <input value={itemForm.defaultUnit} onChange={(e) => setItemForm({ ...itemForm, defaultUnit: e.target.value })} placeholder="단위" aria-label="단위" />
              <button type="submit" className="primary-button" disabled={busy || !itemForm.name.trim()}>품목 추가</button>
            </form>
            {items.length === 0 ? (
              <p className="work-empty">등록된 품목이 없습니다. 기존 시트 import 또는 직접 추가로 채웁니다.</p>
            ) : (
              <table className="work-table">
                <thead>
                  <tr><th>품목명</th><th>분류</th><th>원산지</th><th>단위</th><th>상태</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category ?? "-"}</td>
                      <td>{item.origin ?? "-"}</td>
                      <td>{item.defaultUnit}</td>
                      <td>
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => toggleItem(item)}>
                          {item.isActive ? "사용중" : "비활성"}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => openEditItem(item)}>수정</button>
                        {" "}
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => deleteItem(item)}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="work-section">
            <h2>폐기원인 마스터 ({causes.length})</h2>
            <form className="work-filter-row" onSubmit={addCause}>
              <input value={causeForm.name} onChange={(e) => setCauseForm({ ...causeForm, name: e.target.value })} placeholder="폐기원인 예: 습짐" aria-label="폐기원인" />
              <input type="number" value={causeForm.sortOrder} onChange={(e) => setCauseForm({ ...causeForm, sortOrder: e.target.value })} placeholder="정렬" aria-label="정렬순서" />
              <button type="submit" className="primary-button" disabled={busy || !causeForm.name.trim()}>원인 추가</button>
            </form>
            {causes.length === 0 ? (
              <p className="work-empty">등록된 폐기원인이 없습니다.</p>
            ) : (
              <ul className="work-list">
                {causes.map((cause) => (
                  <li key={cause.id}>
                    <div className="work-list-row" aria-disabled={busy}>
                      <span><strong>{cause.name}</strong></span>
                      <span>정렬 {cause.sortOrder}</span>
                      <span>
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => toggleCause(cause)}>
                          {cause.isActive ? "사용중" : "비활성"}
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {editTarget && (
        <div className="next-dialog-fallback" onClick={closeEditItem}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={saveEditItem}>
            <h2>품목 수정</h2>
            <label className="settings-field">
              품목명
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} aria-label="품목명" />
            </label>
            <label className="settings-field">
              분류
              <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="예: 국화류(선택)" aria-label="분류" />
            </label>
            <label className="settings-field">
              원산지
              <input value={editForm.origin} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} placeholder="예: 국산(선택)" aria-label="원산지" />
            </label>
            <label className="settings-field">
              단위
              <input value={editForm.defaultUnit} onChange={(e) => setEditForm({ ...editForm, defaultUnit: e.target.value })} aria-label="단위" />
            </label>
            <label className="settings-switch-row">
              <span>수입 품목</span>
              <input type="checkbox" style={{ width: "auto" }} checked={editForm.isImported} onChange={(e) => setEditForm({ ...editForm, isImported: e.target.checked })} aria-label="수입여부" />
            </label>
            {editForm.name.trim() !== editTarget.name && (
              <p className="work-empty">품목명을 바꾸면 과거 입고·폐기 기록은 이전 이름으로 남아, 인사이트에서 별개 품목으로 집계될 수 있습니다.</p>
            )}
            {editError && <p className="action-error">{editError}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" disabled={busy} onClick={closeEditItem}>취소</button>
              <button type="submit" className="primary-button" disabled={busy || !editForm.name.trim()}>{busy ? "저장 중" : "저장"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
