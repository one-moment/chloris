import { CHANNEL_TYPES } from "../lib/constants";

export default function ProjectSidebar({
  projects,
  selectedProjectId,
  selectedChannelId,
  onSelectProject,
  onSelectChannel,
  onDeleteChannel,
  onNewProject,
  onNewChannel,
  currentUser,
  onLogout,
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
          <span>{currentUser?.email}</span>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-button" onClick={onNewProject} aria-label="프로젝트 생성">+</button>
          <button className="icon-button sidebar-close-button" onClick={onClose} aria-label="채널 패널 닫기">×</button>
        </div>
      </div>

      <div className="user-card">
        <div>
          <strong>{currentUser?.name}</strong>
          <span>{currentUser?.handle} · {currentUser?.role === "admin" ? "관리자" : "멤버"}</span>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>로그아웃</button>
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
            <div
              key={channel.id}
              className={channel.id === selectedChannelId ? "channel-row active" : "channel-row"}
            >
              <button
                className="channel-item"
                type="button"
                onClick={() => handleSelectChannel(channel.id)}
              >
                <span className="channel-name"># {channel.name}</span>
                <small>{CHANNEL_TYPES[channel.type]?.label}</small>
              </button>
              <button
                className="channel-delete-button"
                type="button"
                onClick={() => onDeleteChannel(channel.id)}
                disabled={project.channels.length <= 1}
                aria-label={`${channel.name} 채널 삭제`}
                title={project.channels.length <= 1 ? "프로젝트에는 최소 1개 채널이 필요합니다" : "채널 삭제"}
              >
                삭제
              </button>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
