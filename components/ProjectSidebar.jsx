import Link from "next/link";
import { CHANNEL_TYPES } from "../lib/constants";
import { getWorkNavItems } from "../modules/registry";
import Icon from "./Icon";

function activityTime(record) {
  const date = new Date(record?.createdAtIso ?? record?.createdAt ?? "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function channelPreview(channel) {
  const message = channel.messages?.[0];
  const post = channel.posts?.[0];
  if (!message && !post) return null;
  if (post && (!message || activityTime(post) >= activityTime(message))) {
    return `글: ${post.title || post.body || "첨부 파일"}`;
  }
  return `${message.author}: ${message.body || "첨부 파일"}`;
}

export default function ProjectSidebar({
  projects,
  selectedProjectId,
  selectedChannelId,
  channelMeta = {},
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
  const workNavItems = getWorkNavItems(currentUser);

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
        <div className="workspace-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/brand/logo-mark-gold.png" alt="보로플라워마켓" />
          <div>
            <strong>{project.name}</strong>
            <span>{currentUser?.email}</span>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-button" onClick={onNewProject} aria-label="프로젝트 생성"><Icon name="plus" size={18} /></button>
          <button className="icon-button sidebar-close-button" onClick={onClose} aria-label="채널 패널 닫기"><Icon name="x" size={18} /></button>
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
                <span className="channel-name-row">
                  <span className="channel-name"># {channel.name}</span>
                  {(channelMeta[channel.id]?.unread ?? 0) > 0 && (
                    <b className={channelMeta[channel.id]?.hasMention ? "unread-badge mention" : "unread-badge"}>
                      {channelMeta[channel.id].unread}
                    </b>
                  )}
                </span>
                <small className="channel-preview">{channelPreview(channel) ?? CHANNEL_TYPES[channel.type]?.label}</small>
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

      {workNavItems.length > 0 && (
        <div className="sidebar-section work-nav-section">
          <div className="section-title">
            <span>업무</span>
          </div>
          <nav className="work-nav">
            {workNavItems.map((item) => (
              <Link key={item.slug} className="work-nav-item" href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}
