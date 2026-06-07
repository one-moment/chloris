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
  const [purchaseConfig, setPurchaseConfig] = useState(DEFAULT_PURCHASE_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [busyBotId, setBusyBotId] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = currentUser?.role === "admin";

  const purchaseEntry = useMemo(
    () => entries.find((entry) => entry.bot?.slug === "purchase-bot"),
    [entries]
  );
  const enabledEntries = entries.filter((entry) => entry.enabled);
  const disabledEntries = entries.filter((entry) => !entry.enabled);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;

    async function loadChannelBots() {
      setIsLoading(true);
      setError("");
      try {
        const result = await requestJson(`/api/channels/${channel.id}/bots`);
        if (cancelled) return;
        const nextEntries = result.bots ?? [];
        setEntries(nextEntries);
        const nextPurchaseEntry = nextEntries.find((entry) => entry.bot?.slug === "purchase-bot");
        setPurchaseConfig(normalizePurchaseConfig(nextPurchaseEntry?.installation?.config ?? nextPurchaseEntry?.bot?.config));
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadChannelBots();
    return () => {
      cancelled = true;
    };
  }, [channel.id, isAdmin, requestJson]);

  if (!isAdmin) return null;

  async function reloadChannelBots() {
    const result = await requestJson(`/api/channels/${channel.id}/bots`);
    const nextEntries = result.bots ?? [];
    setEntries(nextEntries);
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
      <div className="panel-section bot-settings-panel">
        <div className="panel-heading">
          <span>#{channel.name} 채널 설정</span>
          <small>{isLoading ? "불러오는 중" : `${enabledEntries.length} linked`}</small>
        </div>
        {error && <p className="action-error">{error}</p>}

        <div className="bot-settings-group">
          <strong>연동된 봇</strong>
          <div className="channel-bot-list">
            {entries.slice(0, 4).map((entry) => (
              <BotToggleRow
                key={entry.bot.id}
                entry={entry}
                isBusy={busyBotId === entry.bot.id}
                onToggle={toggleBot}
              />
            ))}
          </div>
        </div>

        {purchaseEntry && (
          <div className="bot-settings-group purchase-config-form">
            <strong>구매봇 설정</strong>
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
      </div>

      <div className="panel-section bot-settings-panel">
        <div className="panel-heading">
          <span>봇 / 앱 관리</span>
          <small>{entries.length} apps</small>
        </div>
        <div className="bot-settings-group">
          <strong>사용 가능 봇</strong>
          <div className="available-bot-list">
            {entries.map((entry) => (
              <article key={entry.bot.id} className="available-bot-card">
                <div>
                  <strong>{entry.bot.name}</strong>
                  <span>{entry.bot.type === "external" ? "외부 Webhook" : "내부 앱"} · {entry.enabled ? "채널에 추가됨" : "사용 가능"}</span>
                </div>
                <button type="button" onClick={() => toggleBot(entry, true)} disabled={entry.enabled || busyBotId === entry.bot.id}>
                  {entry.enabled ? "추가됨" : "채널에 추가"}
                </button>
              </article>
            ))}
            {disabledEntries.length === 0 && <p>추가 가능한 봇이 없습니다.</p>}
          </div>
        </div>
      </div>
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
