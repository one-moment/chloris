import { CHANNEL_TYPES, TABS } from "../lib/constants";
import { Badge } from "./common";

export default function Topbar({ project, channel, activeTab, onTabChange }) {
  const type = CHANNEL_TYPES[channel.type];

  return (
    <header className="main-header">
      <div>
        <div className="channel-title">
          <h1>{channel.name}</h1>
          <Badge tone={type?.tone}>{type?.label}</Badge>
        </div>
        <p>{project.description}</p>
      </div>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
