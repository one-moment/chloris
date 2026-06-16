import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATUS_LABEL = {
  active: "정식 멤버",
  pending: "참가 대기",
  invited: "초대됨"
};

const ROLE_LABEL = {
  owner: "소유자",
  member: "멤버"
};

function MemberRow({ member, children }) {
  return (
    <div className="member-row">
      <div className="member-id">
        <strong>{member.user?.name ?? "알 수 없는 사용자"}</strong>
        <span>{member.user?.handle}</span>
      </div>
      <div className="member-row-meta">
        {member.role === "owner" && <span className="member-tag owner">{ROLE_LABEL.owner}</span>}
        {children}
      </div>
    </div>
  );
}

export default function ChannelMembersPanel({ channel, apiRequest, onClose }) {
  const channelId = channel.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const latestQueryRef = useRef("");

  const canManage = me?.canManage ?? false;
  const myStatus = me?.membership?.status ?? null;

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const selfInfo = await apiRequest(`/api/channels/${channelId}/members/me`);
      setMe(selfInfo);
      if (selfInfo.canManage) {
        const list = await apiRequest(`/api/channels/${channelId}/members`);
        setMembers(list.members ?? []);
      } else {
        setMembers([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = { pending: [], active: [], invited: [] };
    for (const member of members) {
      if (groups[member.status]) groups[member.status].push(member);
    }
    return groups;
  }, [members]);

  const memberUserIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);

  async function runAction(key, fn) {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  function post(path, body) {
    return apiRequest(`/api/channels/${channelId}${path}`, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    });
  }

  const requestJoin = () => runAction("self", () => post("/members/join"));
  const acceptInvite = () => runAction("self", () => post("/members/accept"));
  const invite = (userId) => runAction(`invite-${userId}`, () => post("/members", { userId }));
  const approve = (memberId) => runAction(memberId, () => apiRequest(`/api/channels/${channelId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "approve" })
  }));
  const reject = (memberId) => runAction(memberId, () => apiRequest(`/api/channels/${channelId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "reject" })
  }));

  async function searchUsers(value) {
    setInviteQuery(value);
    const query = value.trim();
    latestQueryRef.current = query;
    if (!query) {
      setInviteResults([]);
      return;
    }
    try {
      const data = await apiRequest(`/api/users?query=${encodeURIComponent(query)}`);
      // 입력이 그 사이 바뀌었으면(응답 도착 순서 역전) 오래된 결과는 버린다.
      if (latestQueryRef.current !== query) return;
      setInviteResults(data.users ?? []);
    } catch (err) {
      setError(err.message);
    }
  }

  const inviteCandidates = inviteResults.filter((candidate) => !memberUserIds.has(candidate.id));

  return (
    <div className="next-dialog-fallback" onClick={onClose}>
      <div className="modal-card members-panel" onClick={(event) => event.stopPropagation()}>
        <div className="members-panel-head">
          <h2># {channel.name} 멤버</h2>
          <button className="ghost-button members-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        {error && <p className="members-error">{error}</p>}

        {loading ? (
          <p className="members-empty">불러오는 중...</p>
        ) : (
          <>
            <section className="members-self">
              {myStatus === "active" && (
                <p className="members-note">
                  이 채널의 {ROLE_LABEL[me?.membership?.role] ?? "멤버"}입니다.
                </p>
              )}
              {myStatus === "invited" && (
                <div className="members-self-action">
                  <span>이 채널에 초대받았습니다.</span>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={acceptInvite}
                    disabled={busyKey === "self"}
                  >
                    초대 수락
                  </button>
                </div>
              )}
              {myStatus === "pending" && (
                <p className="members-note">참가 요청을 보냈습니다. 관리자 승인을 기다리는 중입니다.</p>
              )}
              {myStatus === null && canManage && (
                <p className="members-note">관리자 권한으로 이 채널의 멤버를 관리합니다.</p>
              )}
              {myStatus === null && !canManage && (
                <div className="members-self-action">
                  <span>아직 이 채널의 멤버가 아닙니다.</span>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={requestJoin}
                    disabled={busyKey === "self"}
                  >
                    참가 요청
                  </button>
                </div>
              )}
            </section>

            {canManage && (
              <>
                <section className="members-section">
                  <h3>대기 중인 참가 요청 ({grouped.pending.length})</h3>
                  {grouped.pending.length === 0 ? (
                    <p className="members-empty">대기 중인 요청이 없습니다.</p>
                  ) : (
                    grouped.pending.map((member) => (
                      <MemberRow key={member.id} member={member}>
                        <button
                          className="primary-button members-btn-sm"
                          type="button"
                          onClick={() => approve(member.id)}
                          disabled={busyKey === member.id}
                        >
                          승인
                        </button>
                        <button
                          className="ghost-button members-btn-sm"
                          type="button"
                          onClick={() => reject(member.id)}
                          disabled={busyKey === member.id}
                        >
                          거절
                        </button>
                      </MemberRow>
                    ))
                  )}
                </section>

                <section className="members-section">
                  <h3>정식 멤버 ({grouped.active.length})</h3>
                  {grouped.active.length === 0 ? (
                    <p className="members-empty">아직 정식 멤버가 없습니다.</p>
                  ) : (
                    grouped.active.map((member) => (
                      <MemberRow key={member.id} member={member}>
                        <span className="member-tag">{STATUS_LABEL.active}</span>
                      </MemberRow>
                    ))
                  )}
                </section>

                {grouped.invited.length > 0 && (
                  <section className="members-section">
                    <h3>초대됨 ({grouped.invited.length})</h3>
                    {grouped.invited.map((member) => (
                      <MemberRow key={member.id} member={member}>
                        <span className="member-tag invited">{STATUS_LABEL.invited}</span>
                      </MemberRow>
                    ))}
                  </section>
                )}

                <section className="members-section">
                  <h3>멤버 초대</h3>
                  <input
                    className="members-invite-input"
                    value={inviteQuery}
                    onChange={(event) => searchUsers(event.target.value)}
                    placeholder="이름 · 핸들 · 이메일로 검색"
                  />
                  {inviteQuery.trim() && (
                    inviteCandidates.length === 0 ? (
                      <p className="members-empty">초대할 수 있는 사용자가 없습니다.</p>
                    ) : (
                      inviteCandidates.map((candidate) => (
                        <div className="member-row" key={candidate.id}>
                          <div className="member-id">
                            <strong>{candidate.name}</strong>
                            <span>{candidate.handle}</span>
                          </div>
                          <button
                            className="primary-button members-btn-sm"
                            type="button"
                            onClick={() => invite(candidate.id)}
                            disabled={busyKey === `invite-${candidate.id}`}
                          >
                            초대
                          </button>
                        </div>
                      ))
                    )
                  )}
                </section>
              </>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
