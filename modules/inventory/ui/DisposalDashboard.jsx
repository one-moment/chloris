"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";
import { filesToAttachments } from "../../../lib/core/attachments";
import AttachmentList from "../../../components/AttachmentList";
import DisposalLogView from "./DisposalLogView";

// 폐기 입력 폼 (보로 inventory 모듈). 표 입력 + 키보드 이동(Enter/Tab, IME 안전) + 품목 자동완성 +
// 구분/폐기원인 드롭다운 + 임시저장/최종제출(서버 검증 게이트) + 엑셀 복사.
// lot 출처 매핑은 Phase 3-3(다음). 설계: docs/inventory-stockin-disposal.md

const COLS = ["itemName", "quantity", "category", "cause", "note"];

function todayStr() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

let rowSeq = 0;
function emptyRow() {
  rowSeq += 1;
  return { key: `r${rowSeq}`, itemName: "", quantity: "", category: "", cause: "", note: "", sourceLotId: null, unitPrice: null, lotLabel: null };
}

function isFilled(row) {
  return row.itemName.trim() !== "" || String(row.quantity).trim() !== "" || row.cause !== "";
}

function lotShortLabel(lot) {
  const date = new Date(lot.stockInDate);
  const md = Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${md} ${lot.supplier ?? ""}`.trim();
}

function lotDDay(lot, refDateStr) {
  const date = new Date(lot.stockInDate);
  const ref = new Date(refDateStr);
  if (Number.isNaN(date.getTime()) || Number.isNaN(ref.getTime())) return "";
  const diff = Math.round((ref.getTime() - date.getTime()) / 86400000);
  return diff <= 0 ? "당일" : `D-${diff}`;
}

export default function DisposalDashboard() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [disposalDate, setDisposalDate] = useState(todayStr());
  const [categories, setCategories] = useState([]);
  const [causes, setCauses] = useState([]);
  const [rows, setRows] = useState([emptyRow()]);
  const [errorsByLine, setErrorsByLine] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBatchId, setDraftBatchId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [itemSuggest, setItemSuggest] = useState({ row: -1, items: [] });
  const [lotPicker, setLotPicker] = useState({ row: -1, lots: [], loading: false });
  const [managers, setManagers] = useState([]);
  const [reviewerId, setReviewerId] = useState("");
  const [reviewBatches, setReviewBatches] = useState([]);
  const [rejectReasons, setRejectReasons] = useState({});
  const [reviewBusy, setReviewBusy] = useState("");

  const cellRefs = useRef({});
  const pendingFocus = useRef(null);
  const suggestTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [disposalsRes, reasonsRes] = await Promise.all([
          requestJson("/api/work/inventory/disposals?status=__none__"),
          requestJson("/api/work/inventory/reasons")
        ]);
        if (cancelled) return;
        const branchList = disposalsRes.branches ?? [];
        setBranches(branchList);
        setBranchId(branchList[0]?.id ?? "");
        setManagers(disposalsRes.managers ?? []);
        setCategories(reasonsRes.categories ?? []);
        setCauses(reasonsRes.causes ?? []);
        try {
          const reviewRes = await requestJson("/api/work/inventory/disposals?status=review");
          if (!cancelled) setReviewBatches(reviewRes.batches ?? []);
        } catch {
          /* 검수 목록 실패는 무시 */
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택 지점이 바뀌면 그 지점 담당 매니저 후보로 초기화.
  useEffect(() => {
    const forBranch = managers.filter((manager) => manager.branchId === branchId);
    setReviewerId((prev) => (forBranch.some((manager) => manager.id === prev) ? prev : (forBranch[0]?.id ?? "")));
  }, [branchId, managers]);

  async function loadReviews() {
    try {
      const data = await requestJson("/api/work/inventory/disposals?status=review");
      setReviewBatches(data.batches ?? []);
    } catch {
      /* 검수 목록 새로고침 실패는 무시 */
    }
  }

  async function decideReview(batchId, action) {
    setError("");
    setReviewBusy(batchId);
    try {
      const payload = action === "reject"
        ? { action: "reject", rejectReason: rejectReasons[batchId] || "" }
        : { action: "approve" };
      await requestJson(`/api/work/inventory/disposals/${batchId}`, { method: "PATCH", body: JSON.stringify(payload) });
      setMessage(action === "approve" ? "승인 완료 — 시트 연동 활성 시 폐기대장에 기록됩니다." : "반려 처리되었습니다.");
      await loadReviews();
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setReviewBusy("");
    }
  }

  useEffect(() => {
    if (!pendingFocus.current) return;
    const { row, col } = pendingFocus.current;
    pendingFocus.current = null;
    cellRefs.current[`${row}-${col}`]?.focus();
  }, [rows]);

  function focusCell(row, col) {
    cellRefs.current[`${row}-${col}`]?.focus();
  }

  function addRow() {
    setRows((prev) => {
      const next = [...prev, emptyRow()];
      pendingFocus.current = { row: next.length - 1, col: 0 };
      return next;
    });
  }

  function removeRow(index) {
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  }

  function updateCell(index, field, value) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function onCellKeyDown(event, rowIndex, colIndex) {
    if (event.key !== "Enter") return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return; // 한글 IME 조합 중에는 무시
    event.preventDefault();
    if (colIndex < COLS.length - 1) {
      focusCell(rowIndex, colIndex + 1);
    } else if (rowIndex < rows.length - 1) {
      focusCell(rowIndex + 1, 0);
    } else {
      addRow();
    }
  }

  function onItemChange(rowIndex, value) {
    // 품목명이 바뀌면 기존 lot 매핑은 무효 → 초기화
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, itemName: value, sourceLotId: null, unitPrice: null, lotLabel: null } : row)));
    setItemSuggest({ row: rowIndex, items: [] });
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = value.trim();
    if (!q) return;
    suggestTimer.current = setTimeout(async () => {
      try {
        const data = await requestJson(`/api/work/inventory/items?q=${encodeURIComponent(q)}`);
        setItemSuggest({ row: rowIndex, items: data.items ?? [] });
      } catch {
        setItemSuggest({ row: -1, items: [] });
      }
    }, 250);
  }

  async function pickItem(rowIndex, item) {
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, itemName: item.name, sourceLotId: null, unitPrice: null, lotLabel: null } : row)));
    setItemSuggest({ row: -1, items: [] });
    focusCell(rowIndex, 1);
    // 4일 이내 최근 입고 lot을 자동 추천(기본=최신). 관리자는 출처(lot) 칸에서 변경 가능.
    try {
      const data = await requestJson(`/api/work/inventory/lots?item=${encodeURIComponent(item.name)}&date=${encodeURIComponent(disposalDate)}`);
      const newest = (data.lots ?? [])[0];
      if (newest) {
        setRows((prev) => prev.map((row, i) => (i === rowIndex
          ? { ...row, sourceLotId: newest.lotId, unitPrice: newest.unitPrice, lotLabel: lotShortLabel(newest) }
          : row)));
      }
    } catch {
      /* lot 추천 실패는 무시 — 출처(lot) 칸에서 수동 매핑 가능 */
    }
  }

  async function openLotPicker(rowIndex) {
    if (lotPicker.row === rowIndex) {
      setLotPicker({ row: -1, lots: [], loading: false });
      return;
    }
    const item = rows[rowIndex].itemName.trim();
    if (!item) {
      setError("먼저 품목명을 입력하세요.");
      return;
    }
    setLotPicker({ row: rowIndex, lots: [], loading: true });
    try {
      const data = await requestJson(`/api/work/inventory/lots?item=${encodeURIComponent(item)}&date=${encodeURIComponent(disposalDate)}`);
      setLotPicker({ row: rowIndex, lots: data.lots ?? [], loading: false });
    } catch (pickerError) {
      setLotPicker({ row: -1, lots: [], loading: false });
      setError(pickerError.message);
    }
  }

  function applyLot(rowIndex, lot) {
    setRows((prev) => prev.map((row, i) => (i === rowIndex
      ? { ...row, sourceLotId: lot ? lot.lotId : null, unitPrice: lot ? lot.unitPrice : null, lotLabel: lot ? lotShortLabel(lot) : null }
      : row)));
    setLotPicker({ row: -1, lots: [], loading: false });
  }

  // 사진 첨부: 입고·채팅과 동일 경로(압축 → presign → S3/inline). 검수요청에 사진이 필수다.
  async function onAttachmentsChange(fileList) {
    if (!fileList || fileList.length === 0) return;
    setError("");
    setUploadBusy(true);
    try {
      const added = await filesToAttachments(fileList);
      setAttachments((prev) => [...prev, ...added]);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploadBusy(false);
    }
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(status) {
    setError("");
    setMessage("");
    setErrorsByLine({});
    if (!branchId) {
      setError("지점을 선택하세요.");
      return;
    }
    if (status === "review" && !reviewerId) {
      setError("담당 매니저를 선택하세요.");
      return;
    }
    if (status === "review" && attachments.length === 0) {
      // 사진 없이 검수요청을 누르면 명확히 알린다(버튼 비활성만으로는 피드백이 없어 "안 된다"로 오인됨).
      window.alert("검수 요청에는 사진을 1장 이상 첨부해야 합니다.");
      setError("검수요청에는 폐기 사진이 1장 이상 필요합니다. 임시저장은 사진 없이 가능합니다.");
      return;
    }
    const filled = rows.filter(isFilled);
    if (filled.length === 0) {
      setError("폐기 품목을 한 개 이상 입력하세요.");
      return;
    }
    if (filled.length !== rows.length) setRows(filled.length ? filled : [emptyRow()]);

    const lines = filled.map((row) => ({
      itemName: row.itemName.trim(),
      quantity: Number(row.quantity),
      category: row.category,
      cause: row.cause,
      note: row.note?.trim() || null,
      sourceLotId: row.sourceLotId || null
    }));

    const reviewer = managers.find((manager) => manager.id === reviewerId);
    setBusy(true);
    try {
      const body = JSON.stringify({
        status,
        lines,
        disposalDate,
        branchId,
        attachments,
        reviewerId: status === "review" ? reviewerId : undefined,
        reviewerName: status === "review" ? (reviewer?.name ?? null) : undefined
      });
      const result = draftBatchId
        ? await requestJson(`/api/work/inventory/disposals/${draftBatchId}`, { method: "PATCH", body })
        : await requestJson("/api/work/inventory/disposals", { method: "POST", body });

      if (status === "review") {
        setMessage(`검수 요청 완료 · ${result.lineCount}건 — 담당 매니저 승인 후 폐기대장에 반영됩니다.`);
        setRows([emptyRow()]);
        setAttachments([]);
        setDraftBatchId(null);
        await loadReviews();
      } else {
        setDraftBatchId(result.id);
        setMessage("임시저장되었습니다. 이어서 작성하거나 검수 요청하세요.");
      }
    } catch (saveError) {
      const lineErrors = saveError.data?.errors;
      if (Array.isArray(lineErrors) && lineErrors.length) {
        const map = {};
        for (const item of lineErrors) {
          (map[item.lineIndex] = map[item.lineIndex] ?? []).push(item.message);
        }
        setErrorsByLine(map);
      }
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyForExcel() {
    const branchName = branches.find((branch) => branch.id === branchId)?.name ?? "";
    const header = ["날짜", "지점", "품목명", "수량", "구분", "폐기원인", "비고"].join("\t");
    const lines = rows.filter(isFilled).map((row) => (
      [disposalDate, branchName, row.itemName, row.quantity, row.category, row.cause, row.note].join("\t")
    ));
    try {
      await navigator.clipboard.writeText([header, ...lines].join("\n"));
      setMessage("엑셀용으로 복사되었습니다. 시트에 붙여넣으면 열 단위로 들어갑니다.");
    } catch {
      setError("이 환경에서는 클립보드 복사를 지원하지 않습니다.");
    }
  }

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>폐기 입력</h1>
          <p>표로 빠르게 입력하고 담당 매니저를 지정해 검수 요청하면, 매니저 승인 후 폐기대장에 반영·집계됩니다. Enter로 다음 칸, 마지막 칸에서 Enter로 새 행.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section work-filter-row">
        <label>
          지점{" "}
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="지점">
            <option value="">선택</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>
          폐기일{" "}
          <input type="date" value={disposalDate} onChange={(event) => setDisposalDate(event.target.value)} aria-label="폐기일" />
        </label>
        <label>
          담당 매니저{" "}
          <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} aria-label="담당 매니저">
            <option value="">선택</option>
            {managers.filter((manager) => manager.branchId === branchId).map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
            ))}
          </select>
        </label>
        {draftBatchId && <span className="work-badge">임시저장됨</span>}
      </section>

      {error && <p className="action-error">{error}</p>}
      {message && <p className="work-empty">{message}</p>}

      <section className="work-section">
        <div className="work-filter-row" style={{ alignItems: "center" }}>
          <label className="ghost-button" style={{ cursor: (uploadBusy || busy) ? "default" : "pointer", marginBottom: 0 }}>
            📷 사진 첨부
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              disabled={uploadBusy || busy}
              onChange={(event) => { onAttachmentsChange(event.target.files); event.target.value = ""; }}
              aria-label="폐기 사진 첨부"
            />
          </label>
          {uploadBusy && <span className="work-empty" style={{ margin: 0 }}>업로드 중…</span>}
          <span className="work-empty" style={{ margin: 0 }}>검수요청에는 사진이 1장 이상 필요합니다(임시저장은 사진 없이 가능).</span>
        </div>
        <AttachmentList attachments={attachments} onRemove={removeAttachment} />
      </section>

      <section className="work-section">
        <table className="work-table">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>품목명</th>
              <th style={{ width: "12%" }}>수량</th>
              <th style={{ width: "20%" }}>구분</th>
              <th style={{ width: "20%" }}>폐기원인</th>
              <th>비고</th>
              <th style={{ width: "16%" }}>출처(lot)</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowErrors = errorsByLine[rowIndex + 1];
              return (
                <tr key={row.key} style={rowErrors ? { background: "var(--color-background-danger, #fcebeb)" } : undefined}>
                  <td style={{ position: "relative" }}>
                    <input
                      ref={(el) => { cellRefs.current[`${rowIndex}-0`] = el; }}
                      value={row.itemName}
                      onChange={(event) => onItemChange(rowIndex, event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 0)}
                      onBlur={() => setTimeout(() => setItemSuggest((prev) => (prev.row === rowIndex ? { row: -1, items: [] } : prev)), 150)}
                      placeholder="품목명 예: 소국(화이트)"
                      aria-label={`품목명 ${rowIndex + 1}행`}
                    />
                    {itemSuggest.row === rowIndex && itemSuggest.items.length > 0 && (
                      <ul className="work-suggest">
                        {itemSuggest.items.map((item) => (
                          <li key={item.id}>
                            <button type="button" onMouseDown={(event) => { event.preventDefault(); pickItem(rowIndex, item); }}>
                              {item.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <input
                      ref={(el) => { cellRefs.current[`${rowIndex}-1`] = el; }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.quantity}
                      onChange={(event) => updateCell(rowIndex, "quantity", event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 1)}
                      aria-label={`수량 ${rowIndex + 1}행`}
                    />
                  </td>
                  <td>
                    <select
                      ref={(el) => { cellRefs.current[`${rowIndex}-2`] = el; }}
                      value={row.category}
                      onChange={(event) => updateCell(rowIndex, "category", event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 2)}
                      aria-label={`구분 ${rowIndex + 1}행`}
                    >
                      <option value="">선택</option>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      ref={(el) => { cellRefs.current[`${rowIndex}-3`] = el; }}
                      value={row.cause}
                      onChange={(event) => updateCell(rowIndex, "cause", event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 3)}
                      aria-label={`폐기원인 ${rowIndex + 1}행`}
                    >
                      <option value="">선택</option>
                      {causes.map((cause) => <option key={cause} value={cause}>{cause}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      ref={(el) => { cellRefs.current[`${rowIndex}-4`] = el; }}
                      value={row.note}
                      onChange={(event) => updateCell(rowIndex, "note", event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 4)}
                      aria-label={`비고 ${rowIndex + 1}행`}
                    />
                  </td>
                  <td style={{ position: "relative" }}>
                    {row.sourceLotId ? (
                      <span title={row.sourceLotId} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        {row.unitPrice != null ? `${row.unitPrice.toLocaleString("ko-KR")}원` : "매핑됨"}
                        <button type="button" onClick={() => openLotPicker(rowIndex)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)" }} aria-label="출처 변경">변경</button>
                        <button type="button" onClick={() => applyLot(rowIndex, null)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)" }} aria-label="출처 해제">×</button>
                      </span>
                    ) : (
                      <button type="button" className="ghost-button" onClick={() => openLotPicker(rowIndex)}>자동</button>
                    )}
                    {lotPicker.row === rowIndex && (
                      <ul className="work-suggest">
                        {lotPicker.loading && <li><span style={{ display: "block", padding: "6px 8px" }}>불러오는 중...</span></li>}
                        {!lotPicker.loading && lotPicker.lots.length === 0 && <li><span style={{ display: "block", padding: "6px 8px" }}>4일 이내 입고 lot 없음</span></li>}
                        {lotPicker.lots.map((lot, lotIndex) => (
                          <li key={lot.lotId}>
                            <button type="button" onMouseDown={(event) => { event.preventDefault(); applyLot(rowIndex, lot); }}>
                              {lotShortLabel(lot)} · {lot.unitPrice.toLocaleString("ko-KR")}원 · {lotDDay(lot, disposalDate)}{lotIndex === 0 ? " · 추천" : ""}
                            </button>
                          </li>
                        ))}
                        <li>
                          <button type="button" onMouseDown={(event) => { event.preventDefault(); applyLot(rowIndex, null); }}>출처 없음</button>
                        </li>
                      </ul>
                    )}
                  </td>
                  <td>
                    <button type="button" className="ghost-button" onClick={() => removeRow(rowIndex)} aria-label={`${rowIndex + 1}행 삭제`}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {Object.keys(errorsByLine).length > 0 && (
          <ul className="action-error">
            {Object.values(errorsByLine).flat().map((msg) => <li key={msg}>{msg}</li>)}
          </ul>
        )}

        <div className="work-filter-row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="ghost-button" onClick={addRow} disabled={busy}>＋ 행 추가</button>
          <button type="button" className="ghost-button" onClick={() => save("draft")} disabled={busy}>임시저장</button>
          <button type="button" className="primary-button" onClick={() => save("review")} disabled={busy || uploadBusy} title={attachments.length === 0 ? "검수요청에는 사진이 1장 이상 필요합니다" : undefined}>검수 요청</button>
          <button type="button" className="ghost-button" onClick={copyForExcel} disabled={busy}>엑셀로 복사</button>
        </div>
      </section>

      <section className="work-section">
        <h2>검수 대기 (매니저)</h2>
        <p className="work-empty" style={{ marginTop: 0 }}>담당 매니저(또는 관리자)가 승인하면 폐기대장에 기록됩니다. 반려 시 작성자가 수정해 다시 요청할 수 있습니다.</p>
        {reviewBatches.length === 0 ? (
          <p className="work-empty">검수 대기 중인 폐기 기록이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {reviewBatches.map((batch) => {
              const branchName = branches.find((branch) => branch.id === batch.branchId)?.name ?? batch.branchId;
              const dateStr = batch.disposalDate ? String(batch.disposalDate).slice(0, 10) : "";
              return (
                <li key={batch.id} style={{ border: "1px solid var(--line, #dfe4e8)", borderRadius: "8px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <strong>{branchName} · {dateStr}</strong>
                    <span className="work-badge">검수대기</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0" }}>
                    {batch.lineCount}건{batch.totalAmount ? ` · 폐기가액 ${batch.totalAmount.toLocaleString("ko-KR")}원` : ""}
                    {batch.reviewerName ? ` · 담당 ${batch.reviewerName}` : ""}
                  </div>
                  <ul style={{ margin: "4px 0", paddingLeft: "18px", fontSize: "13px" }}>
                    {batch.lines.map((line) => (
                      <li key={line.id}>
                        {line.itemName} {line.quantity}{line.unit} / {line.cause}{" "}
                        <span style={{ color: "var(--muted)" }}>({line.category})</span>
                      </li>
                    ))}
                  </ul>
                  {batch.attachments?.length > 0 && (
                    <div style={{ margin: "6px 0" }}>
                      <span style={{ fontSize: "13px", color: "var(--muted)" }}>첨부사진 {batch.attachments.length}장 — 확인 후 승인하세요.</span>
                      <AttachmentList attachments={batch.attachments} />
                    </div>
                  )}
                  <div className="work-filter-row" style={{ marginTop: "6px" }}>
                    <input
                      value={rejectReasons[batch.id] ?? ""}
                      onChange={(event) => setRejectReasons((prev) => ({ ...prev, [batch.id]: event.target.value }))}
                      placeholder="반려 사유(반려 시)"
                      aria-label="반려 사유"
                    />
                    <button type="button" className="primary-button" disabled={reviewBusy === batch.id} onClick={() => decideReview(batch.id, "approve")}>승인</button>
                    <button type="button" className="ghost-button" disabled={reviewBusy === batch.id} onClick={() => decideReview(batch.id, "reject")}>반려</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DisposalLogView />
    </div>
  );
}
