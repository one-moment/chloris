import { CHANNEL_TYPES, TABS } from "../lib/constants";
import { Badge } from "./common";

export default function Topbar({ project, channel, activeTab, onTabChange, onToggleSidebar }) {
  const type = CHANNEL_TYPES[channel.type];

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
