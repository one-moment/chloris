"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../../../lib/core/apiClient";

const DRAFT_STATUS_LABELS = {
  draft: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
  converted: "작업 분리됨"
};

const VENDOR_LABELS = {
  coupang: "쿠팡",
  swadpia: "성원애드피아",
  gmarket: "지마켓",
  hyundaideco: "현대데코"
};

const VENDOR_TASK_STATUS_LABELS = {
  queued: "worker 대기",
  partially_queued: "일부 대기",
  needs_item_match: "상품 매칭 필요",
  vendor_bot_needed: "거래처 봇 필요"
};

const REQUEST_STATUS_LABELS = {
  pending_approval: "승인 대기",
  approved: "승인됨",
  queued: "작업 대기",
  running: "작업 중",
  cart_ready: "장바구니 준비됨",
  checkout_ready: "결제 전 확인",
  needs_human: "사람 확인 필요",
  rejected: "반려됨",
  failed: "실패"
};

export default function PurchaseDashboard() {
  const [drafts, setDrafts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const state = await requestJson("/api/state");
        if (cancelled) return;
        setDrafts(state.purchaseOrderDrafts ?? []);
        setRequests(state.purchaseRequests ?? []);
        setIsLoaded(true);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError(loadError.message);
          setIsLoaded(true);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isLoaded) {
    return (
      <div className="work-page">
        <p className="work-empty">불러오는 중...</p>
      </div>
    );
  }

  const draftCounts = {
    draft: drafts.filter((draft) => draft.status === "draft").length,
    approved: drafts.filter((draft) => draft.status === "approved" || draft.status === "converted").length
  };
  const vendorTasks = drafts.flatMap((draft) => (draft.vendorTasks ?? []).map((task) => ({ ...task, draftId: draft.id })));
  const queuedRequests = requests.filter((request) => ["queued", "running"].includes(request.status)).length;
  const pendingApprovals = requests.filter((request) => request.status === "pending_approval").length;

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>구매 관리</h1>
          <p>구매요청서 드래프트와 거래처별 작업 현황</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      {error && <p className="action-error">{error}</p>}

      <div className="work-metric-grid">
        <div className="work-metric">
          <span>검토 대기 드래프트</span>
          <strong>{draftCounts.draft}</strong>
        </div>
        <div className="work-metric">
          <span>승인/전환된 드래프트</span>
          <strong>{draftCounts.approved}</strong>
        </div>
        <div className="work-metric">
          <span>승인 대기 구매요청</span>
          <strong>{pendingApprovals}</strong>
        </div>
        <div className="work-metric">
          <span>워커 큐 (대기/실행)</span>
          <strong>{queuedRequests}</strong>
        </div>
      </div>

      <section className="work-section">
        <h2>거래처별 작업</h2>
        {vendorTasks.length === 0 ? (
          <p className="work-empty">아직 거래처 작업이 없습니다.</p>
        ) : (
          <table className="work-table">
            <thead>
              <tr>
                <th>드래프트</th>
                <th>거래처</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {vendorTasks.map((task) => (
                <tr key={task.id}>
                  <td className="work-mono">{task.draftId}</td>
                  <td>{VENDOR_LABELS[task.vendor] ?? task.vendor}</td>
                  <td>{VENDOR_TASK_STATUS_LABELS[task.status] ?? task.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="work-section">
        <h2>최근 드래프트</h2>
        {drafts.length === 0 ? (
          <p className="work-empty">아직 드래프트가 없습니다. 채널에서 @구매에이전트를 멘션해 시작하세요.</p>
        ) : (
          <table className="work-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>요청자</th>
                <th>품목 수</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {drafts.slice(0, 10).map((draft) => (
                <tr key={draft.id}>
                  <td className="work-mono">{draft.id}</td>
                  <td>{draft.requesterName ?? "-"}</td>
                  <td>{draft.lines?.length ?? 0}</td>
                  <td>{DRAFT_STATUS_LABELS[draft.status] ?? draft.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="work-section">
        <h2>최근 구매요청</h2>
        {requests.length === 0 ? (
          <p className="work-empty">구매요청이 없습니다.</p>
        ) : (
          <table className="work-table">
            <thead>
              <tr>
                <th>품목</th>
                <th>거래처</th>
                <th>수량</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 10).map((request) => (
                <tr key={request.id}>
                  <td>{request.itemName}</td>
                  <td>{VENDOR_LABELS[request.vendor] ?? request.vendor}</td>
                  <td>{request.quantity}{request.unitLabel ?? ""}</td>
                  <td>{REQUEST_STATUS_LABELS[request.status] ?? request.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
