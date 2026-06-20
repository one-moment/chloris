import { useEffect, useRef, useState } from "react";

export default function TemplatePicker({ templates = [], channelId, onApply, onManage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // Show templates pinned to this channel, plus channel-agnostic (공통) ones.
  const visible = templates.filter((template) => !template.channelId || template.channelId === channelId);
  const channelTemplates = visible.filter((template) => template.channelId === channelId);
  const common = visible.filter((template) => !template.channelId);

  function pick(template) {
    onApply(template);
    setOpen(false);
  }

  return (
    <div className="template-picker" ref={ref}>
      <button type="button" className="template-picker-button" onClick={() => setOpen((value) => !value)}>
        템플릿
      </button>
      {open && (
        <div className="template-menu" role="menu">
          {visible.length === 0 && <p className="template-menu-empty">이 채널에서 쓸 템플릿이 없습니다.</p>}
          {channelTemplates.length > 0 && <div className="template-menu-label">이 채널</div>}
          {channelTemplates.map((template) => (
            <button key={template.id} type="button" className="template-menu-item" onClick={() => pick(template)}>
              {template.name}
              {template.scope === "personal" && <span className="template-menu-mine">개인</span>}
            </button>
          ))}
          {common.length > 0 && <div className="template-menu-label">공통</div>}
          {common.map((template) => (
            <button key={template.id} type="button" className="template-menu-item" onClick={() => pick(template)}>
              {template.name}
              {template.scope === "personal" && <span className="template-menu-mine">개인</span>}
            </button>
          ))}
          <div className="template-menu-foot">
            <button type="button" onClick={() => { setOpen(false); onManage(); }}>+ 새 템플릿 · 관리</button>
          </div>
        </div>
      )}
    </div>
  );
}
