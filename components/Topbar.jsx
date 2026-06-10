import { useEffect, useRef, useState } from "react";
import { CHANNEL_TYPES, TABS } from "../lib/constants";
import { Badge } from "./common";
import Timestamp from "./Timestamp";

const NOTIFICATION_TYPE_LABELS = {
  mention: "멘션",
  comment: "댓글",
  notice: "공지"
};

export default function Topbar({
  project,
  channel,
  activeTab,
  onTabChange,
  onToggleSidebar,
  notifications = [],
  onNotificationClick,
  onOpenSearch
}) {
  const type = CHANNEL_TYPES[channel.type];
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
          <span />
          <span />
          <span />
        </button>
        <nav className="tabs" aria-label="채널 작업 탭">
          {TABS.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onTabChange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {onOpenSearch && (
            <button className="header-action-button" type="button" onClick={onOpenSearch}>검색</button>
          )}
          <div className="notifications-wrap" ref={notificationsRef}>
            <button
              className="header-action-button"
              type="button"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              aria-label={`알림 ${notifications.length}건`}
            >
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
        </div>
        <p>{project.description}</p>
      </div>
    </header>
  );
}
