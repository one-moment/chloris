import { CHANNEL_TYPES } from "../lib/constants";

export default function ProjectSidebar({
  projects,
  selectedProjectId,
  selectedChannelId,
  onSelectProject,
  onSelectChannel,
  onNewProject,
  onNewChannel,
  isOpen = false,
  onClose
}) {
  const project = projects.find((item) => item.id === selectedProjectId) ?? projects[0];
  const sidebarClassName = isOpen ? "sidebar mobile-open" : "sidebar";

  function handleSelectProject(projectId) {
    onSelectProject(projectId);
    onClose?.();
  }

  function handleSelectChannel(channelId) {
    onSelectChannel(channelId);
    onClose?.();
  }

  return (
    <aside className={sidebarClassName}>
      <div className="workspace-header">
        <div>
          <strong>{project.name}</strong>
          <span>captain@1moment.co.kr</span>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-button" onClick={onNewProject} aria-label="프로젝트 생성">+</button>
          <button className="icon-button sidebar-close-button" onClick={onClose} aria-label="채널 패널 닫기">×</button>
        </div>
      </div>

      <div className="project-switcher">
        {projects.map((item) => (
          <button
            key={item.id}
            className={item.id === selectedProjectId ? "project-pill active" : "project-pill"}
            onClick={() => handleSelectProject(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="section-title">
          <span>Channels</span>
          <button className="ghost-button" onClick={onNewChannel}>채널 생성</button>
        </div>

        <nav className="channel-list">
          {project.channels.map((channel) => (
            <button
              key={channel.id}
              className={channel.id === selectedChannelId ? "channel-item active" : "channel-item"}
              onClick={() => handleSelectChannel(channel.id)}
            >
              <span className="channel-name"># {channel.name}</span>
              <small>{CHANNEL_TYPES[channel.type]?.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
