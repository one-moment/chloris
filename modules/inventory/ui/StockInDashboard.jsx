"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";
import { maybeCompressImage } from "../../../lib/imageCompress";

// 입고 입력 폼 (보로 inventory 모듈). 표 입력 + 키보드 이동(IME 안전) + 품목 자동완성 +
// 발주/영수증/실입고 3중 대조(불일치 하이라이트) + 입고 등록(lotId 자동발번). 거래명세서 OCR은 Phase 4-3.
// 설계: docs/inventory-stockin-disposal.md

const COLS = ["itemName", "orderedQty", "receiptQty", "receivedQty", "unitPrice", "note"];

function todayStr() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

let rowSeq = 0;
function emptyRow() {
  rowSeq += 1;
  return { key: `s${rowSeq}`, itemName: "", orderedQty: "", receiptQty: "", receivedQty: "", unitPrice: "", note: "" };
}

function isFilled(row) {
  return row.itemName.trim() !== "" || String(row.receivedQty).trim() !== "" || String(row.unitPrice).trim() !== "";
}

const STATUS_LABEL = { ok: "일치", discrepancy: "불일치", missing: "미입고", substitute: "대체" };

// 3중 대조 미리보기(서버 stockInLineStatus와 동일 규칙). 실입고 입력 전에는 표시하지 않는다.
function rowStatus(row) {
  if (!row.itemName.trim() || String(row.receivedQty).trim() === "") return null;
  const received = Number(row.receivedQty) || 0;
  if (row.note && /대체/.test(row.note)) return "substitute";
  if (received === 0) return "missing";
  const ordered = row.orderedQty === "" ? null : Number(row.orderedQty);
  const receipt = row.receiptQty === "" ? null : Number(row.receiptQty);
  if (ordered != null && ordered !== received) return "discrepancy";
  if (receipt != null && receipt !== received) return "discrepancy";
  if (ordered != null && receipt != null && ordered !== receipt) return "discrepancy";
  return "ok";
}

function rowBackground(status) {
  if (status === "discrepancy" || status === "missing") return "var(--color-background-danger, #fcebeb)";
  if (status === "substitute") return "var(--color-background-warning, #faeeda)";
  return undefined;
}

export default function StockInDashboard() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [statementDate, setStatementDate] = useState(todayStr());
  const [rows, setRows] = useState([emptyRow()]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [itemSuggest, setItemSuggest] = useState({ row: -1, items: [] });

  const cellRefs = useRef({});
  const pendingFocus = useRef(null);
  const suggestTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await requestJson("/api/work/inventory/stock-ins?status=__none__");
        if (cancelled) return;
        const branchList = data.branches ?? [];
        setBranches(branchList);
        setBranchId(branchList[0]?.id ?? "");
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
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
    updateCell(rowIndex, "itemName", value);
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

  function pickItem(rowIndex, item) {
    updateCell(rowIndex, "itemName", item.name);
    setItemSuggest({ row: -1, items: [] });
    focusCell(rowIndex, 1);
  }

  // 거래명세서 사진 업로드(압축 → presign → S3, inline은 dataURL). 반환 URL을 OCR에 전달.
  async function uploadStatementImage(file) {
    const compressed = await maybeCompressImage(file);
    const target = await requestJson("/api/uploads/presign", {
      method: "POST",
      body: JSON.stringify({ fileName: compressed.name, fileType: compressed.type || "image/jpeg", fileSize: compressed.size })
    });
    if (target.provider === "s3") {
      await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": compressed.type || "image/jpeg" }, body: compressed });
      return target.publicUrl;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
  }

  async function onStatementFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    setOcrBusy(true);
    try {
      const imageUrl = await uploadStatementImage(file);
      const result = await requestJson("/api/work/inventory/stock-ins/ocr", { method: "POST", body: JSON.stringify({ imageUrl }) });
      if (result.degraded) {
        setMessage("자동 인식을 사용할 수 없어 수기 입력으로 진행합니다.");
        return;
      }
      if (result.supplier && !supplier.trim()) setSupplier(result.supplier);
      if (result.statementDate) setStatementDate(result.statementDate);
      const ocrRows = (result.lines ?? []).map((line) => ({
        ...emptyRow(),
        itemName: line.itemName,
        receiptQty: line.quantity ? String(line.quantity) : "",
        receivedQty: line.quantity ? String(line.quantity) : "",
        unitPrice: line.unitPrice ? String(line.unitPrice) : "",
        note: line.note ?? ""
      }));
      if (ocrRows.length === 0) {
        setMessage("명세서에서 품목을 찾지 못했습니다. 수기로 입력하세요.");
        return;
      }
      setRows([...ocrRows, emptyRow()]);
      setMessage(`명세서에서 ${ocrRows.length}건을 불러왔습니다. 발주/실입고를 대조한 뒤 등록하세요.`);
    } catch (ocrError) {
      setError(ocrError.message);
    } finally {
      setOcrBusy(false);
    }
  }

  const totalAmount = rows.reduce((sum, row) => {
    const amount = (Number(row.unitPrice) || 0) * (Number(row.receivedQty) || 0);
    return sum + amount;
  }, 0);

  async function submit() {
    setError("");
    setMessage("");
    if (!branchId) {
      setError("지점을 선택하세요.");
      return;
    }
    if (!supplier.trim()) {
      setError("거래처를 입력하세요.");
      return;
    }
    const lines = rows.filter(isFilled).map((row) => ({
      itemName: row.itemName.trim(),
      orderedQty: row.orderedQty === "" ? null : Number(row.orderedQty),
      receiptQty: row.receiptQty === "" ? null : Number(row.receiptQty),
      quantity: Number(row.receivedQty) || 0,
      unitPrice: Number(row.unitPrice) || 0,
      note: row.note?.trim() || null
    }));
    if (lines.length === 0) {
      setError("입고 품목을 한 개 이상 입력하세요.");
      return;
    }

    setBusy(true);
    try {
      const result = await requestJson("/api/work/inventory/stock-ins", {
        method: "POST",
        body: JSON.stringify({ status: "submitted", branchId, supplier: supplier.trim(), statementDate, lines })
      });
      setMessage(`입고 등록 완료 · ${result.lineCount}건 · 입고가액 ${result.totalAmount.toLocaleString("ko-KR")}원${result.discrepancyCount ? ` · 불일치 ${result.discrepancyCount}건` : ""}`);
      setRows([emptyRow()]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyForExcel() {
    const branchName = branches.find((branch) => branch.id === branchId)?.name ?? "";
    const header = ["입고일", "지점", "거래처", "품목", "발주", "영수증", "실입고", "단가", "입고가액", "특이사항"].join("\t");
    const lines = rows.filter(isFilled).map((row) => {
      const amount = (Number(row.unitPrice) || 0) * (Number(row.receivedQty) || 0);
      return [statementDate, branchName, supplier, row.itemName, row.orderedQty, row.receiptQty, row.receivedQty, row.unitPrice, amount, row.note].join("\t");
    });
    try {
      await navigator.clipboard.writeText([header, ...lines].join("\n"));
      setMessage("엑셀용으로 복사되었습니다.");
    } catch {
      setError("이 환경에서는 클립보드 복사를 지원하지 않습니다.");
    }
  }

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>입고 입력</h1>
          <p>거래명세서를 표로 입력하면 각 행이 lot이 됩니다. 발주/영수증/실입고가 다르면 자동으로 표시됩니다.</p>
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
          거래처{" "}
          <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="예: 오늘꽃" aria-label="거래처" />
        </label>
        <label>
          입고일{" "}
          <input type="date" value={statementDate} onChange={(event) => setStatementDate(event.target.value)} aria-label="입고일" />
        </label>
        <label className="ghost-button" style={{ cursor: ocrBusy ? "default" : "pointer" }}>
          {ocrBusy ? "인식 중..." : "거래명세서 인식"}
          <input type="file" accept="image/*" onChange={onStatementFile} disabled={ocrBusy} style={{ display: "none" }} />
        </label>
      </section>

      {error && <p className="action-error">{error}</p>}
      {message && <p className="work-empty">{message}</p>}

      <section className="work-section">
        <table className="work-table">
          <thead>
            <tr>
              <th style={{ width: "28%" }}>품목명</th>
              <th>발주</th>
              <th>영수증</th>
              <th>실입고</th>
              <th>단가</th>
              <th>특이사항</th>
              <th>상태</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const status = rowStatus(row);
              return (
                <tr key={row.key} style={{ background: rowBackground(status) }}>
                  <td style={{ position: "relative" }}>
                    <input
                      ref={(el) => { cellRefs.current[`${rowIndex}-0`] = el; }}
                      value={row.itemName}
                      onChange={(event) => onItemChange(rowIndex, event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 0)}
                      onBlur={() => setTimeout(() => setItemSuggest((prev) => (prev.row === rowIndex ? { row: -1, items: [] } : prev)), 150)}
                      placeholder="품목명"
                      aria-label={`품목명 ${rowIndex + 1}행`}
                    />
                    {itemSuggest.row === rowIndex && itemSuggest.items.length > 0 && (
                      <ul className="work-suggest">
                        {itemSuggest.items.map((item) => (
                          <li key={item.id}>
                            <button type="button" onMouseDown={(event) => { event.preventDefault(); pickItem(rowIndex, item); }}>{item.name}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  {["orderedQty", "receiptQty", "receivedQty", "unitPrice"].map((field, offset) => (
                    <td key={field}>
                      <input
                        ref={(el) => { cellRefs.current[`${rowIndex}-${offset + 1}`] = el; }}
                        type="number"
                        min="0"
                        step={field === "unitPrice" ? "1" : "0.01"}
                        value={row[field]}
                        onChange={(event) => updateCell(rowIndex, field, event.target.value)}
                        onKeyDown={(event) => onCellKeyDown(event, rowIndex, offset + 1)}
                        aria-label={`${field} ${rowIndex + 1}행`}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      ref={(el) => { cellRefs.current[`${rowIndex}-5`] = el; }}
                      value={row.note}
                      onChange={(event) => updateCell(rowIndex, "note", event.target.value)}
                      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 5)}
                      placeholder="예: 화이트 대체"
                      aria-label={`특이사항 ${rowIndex + 1}행`}
                    />
                  </td>
                  <td>{status ? <span className="work-badge">{STATUS_LABEL[status]}</span> : null}</td>
                  <td>
                    <button type="button" className="ghost-button" onClick={() => removeRow(rowIndex)} aria-label={`${rowIndex + 1}행 삭제`}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="work-filter-row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="ghost-button" onClick={addRow} disabled={busy}>＋ 행 추가</button>
          <button type="button" className="primary-button" onClick={submit} disabled={busy}>입고 등록</button>
          <button type="button" className="ghost-button" onClick={copyForExcel} disabled={busy}>엑셀로 복사</button>
          <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "13px" }}>입고가액 합계 {totalAmount.toLocaleString("ko-KR")}원</span>
        </div>
      </section>
    </div>
  );
}
