import { useEffect, useMemo, useState } from "react";
import { CHANNEL_TYPES } from "../lib/constants";
import BotRunList from "./BotRunList";
import { Badge } from "./common";

const DEFAULT_PURCHASE_CONFIG = {
  allowedVendors: ["coupang", "swadpia"],
  defaultApproverUserIds: [],
  maxAutoApprovedAmount: 50000,
  automationLevel: "add_to_cart",
  requireApproval: true
};

const VENDOR_OPTIONS = [
  { id: "coupang", label: "쿠팡" },
  { id: "swadpia", label: "성원애드피아" }
];

const AUTOMATION_LEVEL_OPTIONS = [
  { id: "open_page", label: "상품 페이지까지" },
  { id: "add_to_cart", label: "장바구니까지" },
  { id: "checkout_ready", label: "결제 직전까지" }
];

function normalizePurchaseConfig(config = {}) {
  return {
    allowedVendors: Array.isArray(config.allowedVendors) ? config.allowedVendors : DEFAULT_PURCHASE_CONFIG.allowedVendors,
    defaultApproverUserIds: Array.isArray(config.defaultApproverUserIds) ? config.defaultApproverUserIds : [],
    maxAutoApprovedAmount: typeof config.maxAutoApprovedAmount === "number" ? config.maxAutoApprovedAmount : DEFAULT_PURCHASE_CONFIG.maxAutoApprovedAmount,
    automationLevel: config.automationLevel || DEFAULT_PURCHASE_CONFIG.automationLevel,
    requireApproval: typeof config.requireApproval === "boolean" ? config.requireApproval : DEFAULT_PURCHASE_CONFIG.requireApproval
  };
}

export default function AutomationPanel({
  channel,
  bots,
  currentUser,
  users,
  requestJson,
  onRunBot,
  onCompleteRun,
  onApproveRun,
  onRejectRun
}) {
  const type = CHANNEL_TYPES[channel.type];

  return (
    <aside className="automation-panel">
      <div className="panel-section">
        <div className="panel-heading">
          <span>채널 목적</span>
          <Badge tone={type?.tone}>{type?.label}</Badge>
        </div>
        <p>{type?.description}</p>
      </div>

      <div className="panel-section">
        <div className="panel-heading">
          <span>자동화 실행</span>
          <small>{bots.length} bots</small>
        </div>
        <div className="bot-list">
          {bots.map((bot) => (
            <article key={bot.id} className="bot-card">
              <div>
                <strong>{bot.name}</strong>
                <span>{bot.provider} · {bot.command}</span>
              </div>
              <button onClick={() => onRunBot(bot)}>실행</button>
            </article>
          ))}
        </div>
      </div>

      <ChannelBotSettings
        channel={channel}
        currentUser={currentUser}
        users={users}
        requestJson={requestJson}
      />

      <BotRunList
        runs={channel.botRuns}
        onCompleteRun={onCompleteRun}
        onApproveRun={onApproveRun}
        onRejectRun={onRejectRun}
      />
    </aside>
  );
}

function ChannelBotSettings({ channel, currentUser, users, requestJson }) {
  const [entries, setEntries] = useState([]);
  const [agentEntries, setAgentEntries] = useState([]);
  const [purchaseConfig, setPurchaseConfig] = useState(DEFAULT_PURCHASE_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [busyBotId, setBusyBotId] = useState("");
  const [busyAgentId, setBusyAgentId] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = currentUser?.role === "admin";

  const purchaseEntry = useMemo(
    () => entries.find((entry) => entry.bot?.slug === "purchase-bot"),
    [entries]
  );
  const purchaseAgentEntry = useMemo(
    () => agentEntries.find((entry) => entry.agent?.slug === "purchase-agent"),
    [agentEntries]
  );
  const enabledEntries = entries.filter((entry) => entry.enabled);
  const disabledEntries = entries.filter((entry) => !entry.enabled);
  const enabledAgentEntries = agentEntries.filter((entry) => entry.enabled);
  const disabledAgentEntries = agentEntries.filter((entry) => !entry.enabled);
  const activeAutomationEntries = [
    ...enabledAgentEntries.map((entry) => ({ kind: "agent", id: entry.agent.id, name: entry.agent.name, description: entry.agent.role })),
    ...enabledEntries.map((entry) => ({ kind: "bot", id: entry.bot.id, name: entry.bot.name, description: entry.bot.type === "external" ? "Webhook" : entry.bot.type }))
  ].slice(0, 3);
  const linkedCount = enabledAgentEntries.length + enabledEntries.length;
  const hasMoreActiveEntries = linkedCount > activeAutomationEntries.length;
  const purchaseAutomationEnabled = Boolean(purchaseAgentEntry?.enabled ?? purchaseEntry?.enabled);
  const purchaseAgentStatus = purchaseAgentEntry
    ? (purchaseAgentEntry.enabled ? "이 채널에서 사용 가능" : "연결 대기")
    : "에이전트 준비 전";

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;

    async function loadChannelAutomation() {
      setIsLoading(true);
      setError("");
      try {
        const [botResult, agentResult] = await Promise.all([
          requestJson(`/api/channels/${channel.id}/bots`),
          requestJson(`/api/channels/${channel.id}/agents`).catch((agentError) => {
            console.error(agentError);
            return { agents: [] };
          })
        ]);
        if (cancelled) return;
        const nextEntries = botResult.bots ?? [];
        const nextAgentEntries = agentResult.agents ?? [];
        setEntries(nextEntries);
        setAgentEntries(nextAgentEntries);
        const nextPurchaseEntry = nextEntries.find((entry) => entry.bot?.slug === "purchase-bot");
        setPurchaseConfig(normalizePurchaseConfig(nextPurchaseEntry?.installation?.config ?? nextPurchaseEntry?.bot?.config));
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadChannelAutomation();
    return () => {
      cancelled = true;
    };
  }, [channel.id, isAdmin, requestJson]);

  if (!isAdmin) return null;

  async function reloadChannelBots() {
    const [botResult, agentResult] = await Promise.all([
      requestJson(`/api/channels/${channel.id}/bots`),
      requestJson(`/api/channels/${channel.id}/agents`).catch((agentError) => {
        console.error(agentError);
        return { agents: [] };
      })
    ]);
    const nextEntries = botResult.bots ?? [];
    const nextAgentEntries = agentResult.agents ?? [];
    setEntries(nextEntries);
    setAgentEntries(nextAgentEntries);
    const nextPurchaseEntry = nextEntries.find((entry) => entry.bot?.slug === "purchase-bot");
    setPurchaseConfig(normalizePurchaseConfig(nextPurchaseEntry?.installation?.config ?? nextPurchaseEntry?.bot?.config));
  }

  async function toggleBot(entry, enabled) {
    setBusyBotId(entry.bot.id);
    setError("");
    try {
      await requestJson(`/api/channels/${channel.id}/bots/${entry.bot.slug}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({
          config: entry.bot.slug === "purchase-bot" ? purchaseConfig : {}
        })
      });
      await reloadChannelBots();
    } catch (toggleError) {
      console.error(toggleError);
      setError(toggleError.message);
    } finally {
      setBusyBotId("");
    }
  }

  async function toggleAgent(entry, enabled) {
    setBusyAgentId(entry.agent.id);
    setError("");
    try {
      await requestJson(`/api/channels/${channel.id}/agents/${entry.agent.slug}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({
          config: entry.agent.slug === "purchase-agent"
            ? { allowedTools: ["purchase.create_request", "purchase.request_approval", "purchase.enqueue_worker_task"], paymentAutomationAllowed: false }
            : {}
        })
      });
      await reloadChannelBots();
    } catch (toggleError) {
      console.error(toggleError);
      setError(toggleError.message);
    } finally {
      setBusyAgentId("");
    }
  }

  function setVendor(vendorId, checked) {
    setPurchaseConfig((current) => ({
      ...current,
      allowedVendors: checked
        ? Array.from(new Set([...current.allowedVendors, vendorId]))
        : current.allowedVendors.filter((vendor) => vendor !== vendorId)
    }));
  }

  async function savePurchaseConfig() {
    setIsSavingConfig(true);
    setError("");
    try {
      const nextConfig = normalizePurchaseConfig(purchaseConfig);
      await requestJson(`/api/channels/${channel.id}/bots/purchase-bot/config`, {
        method: "PATCH",
        body: JSON.stringify({ config: nextConfig })
      });
      await reloadChannelBots();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message);
    } finally {
      setIsSavingConfig(false);
    }
  }

  return (
    <>
      <div className="panel-section channel-automation-summary">
        <div className="panel-heading">
          <span>채널 자동화</span>
          <small>{isLoading ? "불러오는 중" : `${linkedCount} linked`}</small>
        </div>
        {error && <p className="action-error">{error}</p>}

        <div className="automation-summary-list">
          <article className="automation-summary-row">
            <div>
              <strong>구매 에이전트</strong>
              <span>구매봇 도구 · {purchaseAgentStatus}</span>
            </div>
            <span className={`status-pill ${purchaseAutomationEnabled ? "on" : ""}`}>
              {purchaseAutomationEnabled ? "ON" : "OFF"}
            </span>
          </article>

          {activeAutomationEntries.map((entry) => (
            <article key={`${entry.kind}-${entry.id}`} className="automation-summary-row compact">
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
              </div>
              <span className="status-pill on">ON</span>
            </article>
          ))}

          {linkedCount === 0 && <p>연결된 에이전트나 봇이 없습니다.</p>}
          {hasMoreActiveEntries && (
            <small className="automation-more-text">그 외 {linkedCount - activeAutomationEntries.length}개가 연결되어 있습니다.</small>
          )}
        </div>

        <button className="primary-button settings-open-button" type="button" onClick={() => setIsSettingsOpen(true)}>
          에이전트 / 봇 설정
        </button>
      </div>

      {isSettingsOpen && (
        <div className="next-dialog-fallback">
          <section className="modal-card automation-settings-modal" role="dialog" aria-modal="true" aria-labelledby="automation-settings-title">
            <div className="modal-header">
              <div>
                <h2 id="automation-settings-title">#{channel.name} 자동화 설정</h2>
                <p>채널에 연결할 에이전트와 실행 도구를 관리합니다.</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsSettingsOpen(false)}>닫기</button>
            </div>

            {error && <p className="action-error">{error}</p>}

            <div className="automation-settings-grid">
              <div className="bot-settings-panel">
                <div className="panel-heading">
                  <span>연동된 에이전트 / 봇</span>
                  <small>{linkedCount} linked</small>
                </div>
                <div className="bot-settings-group">
                  <strong>직무 에이전트</strong>
                  <div className="channel-bot-list">
                    {agentEntries.map((entry) => (
                      <AgentToggleRow
                        key={entry.agent.id}
                        entry={entry}
                        isBusy={busyAgentId === entry.agent.id}
                        onToggle={toggleAgent}
                      />
                    ))}
                    {agentEntries.length === 0 && (
                      <p className="automation-muted-text">Agent migration 적용 후 직무 에이전트를 연결할 수 있습니다.</p>
                    )}
                  </div>
                </div>
                <div className="bot-settings-group">
                  <strong>실행 도구 / 봇</strong>
                  <div className="channel-bot-list">
                    {entries.map((entry) => (
                      <BotToggleRow
                        key={entry.bot.id}
                        entry={entry}
                        isBusy={busyBotId === entry.bot.id}
                        onToggle={toggleBot}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bot-settings-panel">
                {purchaseEntry && (
                  <div className="bot-settings-group purchase-config-form">
                    <strong>구매 에이전트 설정</strong>
                    <label className="settings-switch-row">
                      <span>이 채널에서 구매요청 허용</span>
                      <button
                        type="button"
                        className={`switch-button ${purchaseEntry.enabled ? "on" : ""}`}
                        onClick={() => toggleBot(purchaseEntry, !purchaseEntry.enabled)}
                        disabled={busyBotId === purchaseEntry.bot.id}
                      >
                        {purchaseEntry.enabled ? "ON" : "OFF"}
                      </button>
                    </label>

                    <label className="settings-field">
                      <span>승인자</span>
                      <select
                        value={purchaseConfig.defaultApproverUserIds[0] ?? ""}
                        onChange={(event) => setPurchaseConfig((current) => ({
                          ...current,
                          defaultApproverUserIds: event.target.value ? [event.target.value] : []
                        }))}
                      >
                        <option value="">관리자 전체</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="settings-field">
                      <span>자동화 레벨</span>
                      <select
                        value={purchaseConfig.automationLevel}
                        onChange={(event) => setPurchaseConfig((current) => ({ ...current, automationLevel: event.target.value }))}
                      >
                        {AUTOMATION_LEVEL_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <div className="settings-field">
                      <span>허용 공급처</span>
                      <div className="settings-check-list">
                        {VENDOR_OPTIONS.map((vendor) => (
                          <label key={vendor.id}>
                            <input
                              type="checkbox"
                              checked={purchaseConfig.allowedVendors.includes(vendor.id)}
                              onChange={(event) => setVendor(vendor.id, event.target.checked)}
                            />
                            {vendor.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="settings-switch-row">
                      <span>5만원 초과 시 승인 필요</span>
                      <button
                        type="button"
                        className={`switch-button ${purchaseConfig.requireApproval ? "on" : ""}`}
                        onClick={() => setPurchaseConfig((current) => ({
                          ...current,
                          requireApproval: !current.requireApproval,
                          maxAutoApprovedAmount: 50000
                        }))}
                      >
                        {purchaseConfig.requireApproval ? "ON" : "OFF"}
                      </button>
                    </label>

                    <button className="primary-button settings-save-button" type="button" onClick={savePurchaseConfig} disabled={isSavingConfig}>
                      {isSavingConfig ? "저장 중" : "설정 저장"}
                    </button>
                  </div>
                )}

                <div className="bot-settings-group">
                  <strong>사용 가능 에이전트 / 봇</strong>
                  <div className="available-bot-list">
                    {disabledAgentEntries.map((entry) => (
                      <article key={entry.agent.id} className="available-bot-card">
                        <div>
                          <strong>{entry.agent.name}</strong>
                          <span>직무 에이전트 · {entry.agent.role}</span>
                        </div>
                        <button type="button" onClick={() => toggleAgent(entry, true)} disabled={busyAgentId === entry.agent.id}>
                          채널에 추가
                        </button>
                      </article>
                    ))}
                    {disabledEntries.map((entry) => (
                      <article key={entry.bot.id} className="available-bot-card">
                        <div>
                          <strong>{entry.bot.name}</strong>
                          <span>{entry.bot.type === "external" ? "외부 Webhook" : "내부 앱"} · 사용 가능</span>
                        </div>
                        <button type="button" onClick={() => toggleBot(entry, true)} disabled={busyBotId === entry.bot.id}>
                          채널에 추가
                        </button>
                      </article>
                    ))}
                    {disabledAgentEntries.length === 0 && disabledEntries.length === 0 && <p>추가 가능한 에이전트나 봇이 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function BotToggleRow({ entry, isBusy, onToggle }) {
  return (
    <article className="channel-bot-row">
      <div>
        <strong>{entry.bot.name}</strong>
        <span>{entry.bot.type === "external" ? "Webhook" : entry.bot.type}</span>
      </div>
      <button
        type="button"
        className={`switch-button ${entry.enabled ? "on" : ""}`}
        onClick={() => onToggle(entry, !entry.enabled)}
        disabled={isBusy}
      >
        {entry.enabled ? "ON" : "OFF"}
      </button>
    </article>
  );
}

function AgentToggleRow({ entry, isBusy, onToggle }) {
  return (
    <article className="channel-bot-row agent-toggle-row">
      <div>
        <strong>{entry.agent.name}</strong>
        <span>{entry.agent.role} agent</span>
      </div>
      <button
        type="button"
        className={`switch-button ${entry.enabled ? "on" : ""}`}
        onClick={() => onToggle(entry, !entry.enabled)}
        disabled={isBusy}
      >
        {entry.enabled ? "ON" : "OFF"}
      </button>
    </article>
  );
}
