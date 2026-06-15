import { useEffect, useRef, useState } from "react";
import { CHANNEL_TYPES, TABS } from "../lib/constants";
import { Badge } from "./common";
import Icon from "./Icon";
import Timestamp from "./Timestamp";

const NOTIFICATION_TYPE_LABELS = {
  mention: "멘션",
  comment: "댓글",
  notice: "공지"
};

const TAB_ICONS = {
  messages: "message-circle",
  ideas: "lightbulb",
  files: "folder-closed"
};

export default function Topbar({
  project,
  channel,
  activeTab,
  onTabChange,
  onToggleSidebar,
  notifications = [],
  onNotificationClick,
  onOpenSearch,
  branches = [],
  currentUser,
  onChangeBranch
}) {
  const type = CHANNEL_TYPES[channel.type];
  const channelBranch = branches.find((branch) => branch.id === channel.branchId);
  const canEditBranch = currentUser?.role === "admin" && onChangeBranch && branches.length > 0;
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);

  useEffect(() => {
    if (!isNotificationsOpen) return undefined;
    function handleOutsideClick(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isNotificationsOpen]);

  function openNotification(item) {
    setIsNotificationsOpen(false);
    onNotificationClick?.(item);
  }

  return (
    <header className="main-header">
      <div className="header-nav-row">
        <button className="channel-menu-button" type="button" onClick={onToggleSidebar} aria-label="채널 패널 열기">
          <Icon name="menu" size={20} />
        </button>
        <nav className="tabs" aria-label="채널 작업 탭">
          {TABS.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onTabChange(tab.id)}>
              {TAB_ICONS[tab.id] && <Icon name={TAB_ICONS[tab.id]} size={16} />}
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {onOpenSearch && (
            <button className="header-action-button" type="button" onClick={onOpenSearch}><Icon name="search" size={15} />검색</button>
          )}
          <div className="notifications-wrap" ref={notificationsRef}>
            <button
              className="header-action-button"
              type="button"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              aria-label={`알림 ${notifications.length}건`}
            >
              <Icon name="bell" size={15} />
              알림
              {notifications.length > 0 && <b className="notification-count">{notifications.length}</b>}
            </button>
            {isNotificationsOpen && (
              <div className="notifications-panel" role="menu">
                {notifications.length === 0 ? (
                  <p className="notifications-empty">새 알림이 없습니다.</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.key}
                      className="notification-item"
                      type="button"
                      onClick={() => openNotification(item)}
                    >
                      <span className="notification-meta">
                        <span className={`notification-type ${item.type}`}>{NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}</span>
                        <strong>{item.author}</strong>
                        <span># {item.channelName}</span>
                        <Timestamp createdAt={item.createdAtIso} />
                      </span>
                      <span className="notification-snippet">{item.snippet}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="header-channel-row">
        <div className="channel-title">
          <h1>{channel.name}</h1>
          <Badge tone={type?.tone}>{type?.label}</Badge>
          {canEditBranch ? (
            <select
              className="branch-select"
              value={channel.branchId ?? ""}
              onChange={(event) => onChangeBranch(channel.id, event.target.value || null)}
              aria-label="채널 지점 설정"
            >
              <option value="">지점 없음</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          ) : channelBranch ? (
            <span className="branch-badge">{channelBranch.name}</span>
          ) : null}
        </div>
        <p>{project.description}</p>
      </div>
    </header>
  );
}
