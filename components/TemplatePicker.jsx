import { useEffect, useRef, useState } from "react";

export default function TemplatePicker({ templates = [], onApply, onManage }) {
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

  const shared = templates.filter((template) => template.scope === "shared");
  const mine = templates.filter((template) => template.scope === "personal");

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
          {templates.length === 0 && <p className="template-menu-empty">저장된 템플릿이 없습니다.</p>}
          {shared.length > 0 && <div className="template-menu-label">공유</div>}
          {shared.map((template) => (
            <button key={template.id} type="button" className="template-menu-item" onClick={() => pick(template)}>
              {template.name}
            </button>
          ))}
          {mine.length > 0 && <div className="template-menu-label">내 템플릿</div>}
          {mine.map((template) => (
            <button key={template.id} type="button" className="template-menu-item" onClick={() => pick(template)}>
              {template.name}
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
