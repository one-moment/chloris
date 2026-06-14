import { useState } from "react";

const BODY_PLACEHOLDER = "[주문서 / {{지점}}]\n• 성함 :\n• 연락처 :\n• 픽업 일시 :\n• 상품 :";

export default function TemplateManagerDialog({ templates = [], currentUser, onCreate, onUpdate, onDelete, onClose }) {
  const isAdmin = currentUser?.role === "admin";
  const [editing, setEditing] = useState(null); // null | "new" | templateId
  const [form, setForm] = useState({ name: "", body: "", scope: "personal" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function canManage(template) {
    if (isAdmin) return true;
    if (template.scope === "shared") return false;
    return template.ownerId === currentUser?.id;
  }

  function startNew() {
    setEditing("new");
    setForm({ name: "", body: "", scope: "personal" });
    setError("");
  }

  function startEdit(template) {
    setEditing(template.id);
    setForm({ name: template.name, body: template.body, scope: template.scope });
    setError("");
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      setError("이름과 내용을 입력하세요.");
      return;
    }
    setBusy(true);
    const result = editing === "new" ? await onCreate(form) : await onUpdate(editing, form);
    setBusy(false);
    if (result?.ok === false) {
      setError(result.error || "저장에 실패했습니다.");
      return;
    }
    setEditing(null);
  }

  async function remove(template) {
    if (!window.confirm(`'${template.name}' 템플릿을 삭제할까요?`)) return;
    await onDelete(template.id);
  }

  return (
    <div className="next-dialog-fallback" onClick={onClose}>
      <section
        className="modal-card template-manager"
        role="dialog"
        aria-modal="true"
        aria-label="템플릿 관리"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="template-manager-head">
          <h2>템플릿 관리</h2>
          {!editing && <button type="button" className="primary-button" onClick={startNew}>새 템플릿</button>}
        </div>
        <p className="template-hint">
          {"치환: {{지점}} {{오늘}} {{작성자}} · 첫 줄은 제목, 나머지는 본문이 됩니다."}
        </p>

        {editing ? (
          <div className="template-form">
            <label className="settings-field">
              이름 (목록 표시)
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="예: 주문서, 인계사항, 구매요청"
                autoFocus
              />
            </label>
            <label className="settings-field">
              내용
              <textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={8}
                placeholder={BODY_PLACEHOLDER}
              />
            </label>
            {isAdmin && (
              <label className="template-scope">
                <input
                  type="checkbox"
                  checked={form.scope === "shared"}
                  onChange={(event) => setForm({ ...form, scope: event.target.checked ? "shared" : "personal" })}
                />
                공유 템플릿 (모든 구성원에게 노출)
              </label>
            )}
            {error && <p className="action-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setEditing(null)} disabled={busy}>취소</button>
              <button type="button" className="primary-button" onClick={save} disabled={busy}>{busy ? "저장 중" : "저장"}</button>
            </div>
          </div>
        ) : (
          <div className="template-list">
            {templates.length === 0 && (
              <p className="template-menu-empty">아직 템플릿이 없습니다. &quot;새 템플릿&quot;으로 만들어보세요.</p>
            )}
            {templates.map((template) => (
              <div key={template.id} className="template-row">
                <div className="template-row-main">
                  <strong>{template.name}</strong>
                  <span className={template.scope === "shared" ? "template-tag shared" : "template-tag personal"}>
                    {template.scope === "shared" ? "공유" : "개인"}
                  </span>
                </div>
                <div className="template-row-actions">
                  {canManage(template) && <button type="button" onClick={() => startEdit(template)}>수정</button>}
                  {canManage(template) && <button type="button" onClick={() => remove(template)}>삭제</button>}
                </div>
              </div>
            ))}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>닫기</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
