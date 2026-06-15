"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

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
  const [itemSuggest, setItemSuggest] = useState({ row: -1, items: [] });
  const [lotPicker, setLotPicker] = useState({ row: -1, lots: [], loading: false });

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
        setCategories(reasonsRes.categories ?? []);
        setCauses(reasonsRes.causes ?? []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function save(status) {
    setError("");
    setMessage("");
    setErrorsByLine({});
    if (!branchId) {
      setError("지점을 선택하세요.");
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

    setBusy(true);
    try {
      const body = JSON.stringify({ status, lines, disposalDate, branchId });
      const result = draftBatchId
        ? await requestJson(`/api/work/inventory/disposals/${draftBatchId}`, { method: "PATCH", body })
        : await requestJson("/api/work/inventory/disposals", { method: "POST", body });

      if (status === "submitted") {
        setMessage(`최종제출 완료 · ${result.lineCount}건${result.totalAmount ? ` · 폐기가액 ${result.totalAmount.toLocaleString("ko-KR")}원` : ""}`);
        setRows([emptyRow()]);
        setDraftBatchId(null);
      } else {
        setDraftBatchId(result.id);
        setMessage("임시저장되었습니다. 이어서 작성하거나 최종제출하세요.");
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
          <p>표로 빠르게 입력하고 최종제출하면 검증 후 집계됩니다. Enter로 다음 칸, 마지막 칸에서 Enter로 새 행.</p>
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
        {draftBatchId && <span className="work-badge">임시저장됨</span>}
      </section>

      {error && <p className="action-error">{error}</p>}
      {message && <p className="work-empty">{message}</p>}

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
          <button type="button" className="primary-button" onClick={() => save("submitted")} disabled={busy}>최종제출</button>
          <button type="button" className="ghost-button" onClick={copyForExcel} disabled={busy}>엑셀로 복사</button>
        </div>
      </section>
    </div>
  );
}
