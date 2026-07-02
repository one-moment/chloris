"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "../lib/core/apiClient";

// 지점 매니저 관리 (admin 전용, 보로 게이팅). 목록 / 지정 / 범위수정·해제.
// API: /api/branch-managers, /api/branch-managers/[userId], /api/branches, /api/users?query=.
// supervisor = 전 지점 매니저 중 User.role!=="admin" (UI 라벨, PLAN v5 §6).

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function roleBadge(manager) {
  if (!manager.isAllBranches) return null;
  return manager.user.role === "admin" ? "전 지점 매니저(admin)" : "supervisor";
}

const EMPTY_ASSIGN = { user: null, isAllBranches: false, branchIds: [] };

export default function BranchManagerAdmin() {
  const [version, setVersion] = useState(0);
  const [managers, setManagers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 지정 폼
  const [assign, setAssign] = useState(EMPTY_ASSIGN);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // 범위 수정 (인라인)
  const [editing, setEditing] = useState(null); // { userId, isAllBranches, branchIds }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [managersRes, branchesRes] = await Promise.all([
          requestJson("/api/branch-managers"),
          requestJson("/api/branches")
        ]);
        if (cancelled) return;
        setManagers(managersRes.managers ?? []);
        setBranches(branchesRes.branches ?? []);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  async function searchUsers(event) {
    event.preventDefault();
    const query = userQuery.trim();
    if (!query) return;
    setSearching(true);
    try {
      const res = await requestJson(`/api/users?query=${encodeURIComponent(query)}`);
      setUserResults(res.users ?? []);
      setError("");
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setSearching(false);
    }
  }

  function toggleAssignBranch(branchId) {
    setAssign((prev) => {
      const has = prev.branchIds.includes(branchId);
      return { ...prev, branchIds: has ? prev.branchIds.filter((id) => id !== branchId) : [...prev.branchIds, branchId] };
    });
  }

  async function submitAssign() {
    if (!assign.user) return;
    if (!assign.isAllBranches && assign.branchIds.length === 0) {
      setError("지점을 한 개 이상 선택하거나 '전 지점'을 켜세요.");
      return;
    }
    await runAction(async () => {
      await requestJson("/api/branch-managers", {
        method: "POST",
        body: JSON.stringify({ userId: assign.user.id, isAllBranches: assign.isAllBranches, branchIds: assign.branchIds })
      });
      setAssign(EMPTY_ASSIGN);
      setUserQuery("");
      setUserResults([]);
    });
  }

  function startEdit(manager) {
    setEditing({
      userId: manager.userId,
      isAllBranches: manager.isAllBranches,
      branchIds: manager.branches.map((branch) => branch.id)
    });
  }

  function toggleEditBranch(branchId) {
    setEditing((prev) => {
      const has = prev.branchIds.includes(branchId);
      return { ...prev, branchIds: has ? prev.branchIds.filter((id) => id !== branchId) : [...prev.branchIds, branchId] };
    });
  }

  async function submitEdit() {
    if (!editing) return;
    if (!editing.isAllBranches && editing.branchIds.length === 0) {
      setError("지점을 한 개 이상 선택하거나 '전 지점'을 켜세요.");
      return;
    }
    await runAction(async () => {
      await requestJson(`/api/branch-managers/${editing.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ isAllBranches: editing.isAllBranches, branchIds: editing.branchIds })
      });
      setEditing(null);
    });
  }

  function unassign(manager) {
    if (!window.confirm(`${manager.user.name} 님의 매니저 권한을 해제할까요? (staff 강등 — 되돌릴 수 있습니다)`)) return;
    runAction(() => requestJson(`/api/branch-managers/${manager.userId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "unassign" })
    }));
  }

  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>지점 매니저</h1>
          <p>지점 매니저를 지정·수정·해제합니다. 전 지점 권한은 신규 지점까지 자동 포함하며, 비admin이면 supervisor로 표시됩니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      {error && <p className="action-error">{error}</p>}
      {loading ? (
        <section className="work-section"><p className="work-empty">불러오는 중...</p></section>
      ) : (
        <>
          <section className="work-section">
            <h2>매니저 지정</h2>
            <form className="work-filter-row" onSubmit={searchUsers}>
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="사용자 검색 (이름·이메일·핸들)"
                aria-label="사용자 검색"
              />
              <button type="submit" className="ghost-button" disabled={searching || !userQuery.trim()}>검색</button>
            </form>

            {userResults.length > 0 && !assign.user && (
              <ul className="work-list">
                {userResults.map((candidate) => (
                  <li key={candidate.id}>
                    <div className="work-list-row">
                      <span><strong>{candidate.name}</strong> @{candidate.handle}{candidate.role === "admin" ? " · admin" : ""}</span>
                      <span>{candidate.email}</span>
                      <span>
                        <button type="button" className="primary-button" onClick={() => { setAssign({ ...EMPTY_ASSIGN, user: candidate }); setUserResults([]); }}>선택</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {assign.user && (
              <div className="work-section" style={{ marginTop: "0.75rem" }}>
                <p><strong>{assign.user.name}</strong> @{assign.user.handle} 을(를) 매니저로 지정</p>
                <label style={{ display: "block", margin: "0.5rem 0" }}>
                  <input
                    type="checkbox"
                    checked={assign.isAllBranches}
                    onChange={(event) => setAssign({ ...assign, isAllBranches: event.target.checked })}
                  /> 전 지점{assign.user.role !== "admin" ? " (supervisor)" : ""}
                </label>
                {!assign.isAllBranches && (
                  <div className="work-filter-row" style={{ flexWrap: "wrap" }}>
                    {branches.map((branch) => (
                      <label key={branch.id} style={{ marginRight: "0.75rem" }}>
                        <input
                          type="checkbox"
                          checked={assign.branchIds.includes(branch.id)}
                          onChange={() => toggleAssignBranch(branch.id)}
                        /> {branch.name}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="primary-button" disabled={busy} onClick={submitAssign}>지정 확인</button>
                  {" "}
                  <button type="button" className="ghost-button" disabled={busy} onClick={() => setAssign(EMPTY_ASSIGN)}>취소</button>
                </div>
              </div>
            )}
          </section>

          <section className="work-section">
            <h2>매니저 목록 ({managers.length})</h2>
            {managers.length === 0 ? (
              <p className="work-empty">지정된 매니저가 없습니다.</p>
            ) : (
              <table className="work-table">
                <thead>
                  <tr><th>이름</th><th>담당</th><th>역할</th><th>최근 변경</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {managers.map((manager) => (
                    <tr key={manager.userId}>
                      <td><strong>{manager.user.name}</strong><br />@{manager.user.handle}</td>
                      <td>
                        {manager.isAllBranches
                          ? "전 지점"
                          : (manager.branches.map((branch) => branch.name).join(", ") || "-")}
                      </td>
                      <td>{roleBadge(manager) ?? "지점 매니저"}</td>
                      <td>{formatDate(manager.updatedAt)}{manager.updatedByName ? ` · ${manager.updatedByName}` : ""}</td>
                      <td>
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => startEdit(manager)}>범위 수정</button>
                        {" "}
                        <button type="button" className="ghost-button" disabled={busy} onClick={() => unassign(manager)}>해제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {editing && (
            <section className="work-section">
              <h2>범위 수정</h2>
              <label style={{ display: "block", margin: "0.5rem 0" }}>
                <input
                  type="checkbox"
                  checked={editing.isAllBranches}
                  onChange={(event) => setEditing({ ...editing, isAllBranches: event.target.checked })}
                /> 전 지점
              </label>
              {!editing.isAllBranches && (
                <div className="work-filter-row" style={{ flexWrap: "wrap" }}>
                  {branches.map((branch) => (
                    <label key={branch.id} style={{ marginRight: "0.75rem" }}>
                      <input
                        type="checkbox"
                        checked={editing.branchIds.includes(branch.id)}
                        onChange={() => toggleEditBranch(branch.id)}
                      /> {branch.name}
                    </label>
                  ))}
                </div>
              )}
              <div style={{ marginTop: "0.5rem" }}>
                <button type="button" className="primary-button" disabled={busy} onClick={submitEdit}>저장</button>
                {" "}
                <button type="button" className="ghost-button" disabled={busy} onClick={() => setEditing(null)}>취소</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
