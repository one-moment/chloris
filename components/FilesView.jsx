import { EmptyState } from "./common";

export default function FilesView({ channel, draft, onDraftChange, onAddFile }) {
  return (
    <section className="content-column">
      <div className="file-uploader">
        <input
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          placeholder="파일명 또는 연결 문서명"
        />
        <input
          value={draft.source}
          onChange={(event) => onDraftChange({ ...draft, source: event.target.value })}
          placeholder="출처"
        />
        <button className="primary-button" onClick={onAddFile} disabled={!draft.name.trim()}>Add file</button>
      </div>

      <div className="file-list">
        {channel.files.length === 0 ? (
          <EmptyState title="파일이 없습니다" body="첨부파일, 자동화 결과물, 연결 스프레드시트를 이곳에서 관리합니다." />
        ) : (
          channel.files.map((file) => (
            <article key={file.id} className="file-card">
              <strong>{file.name}</strong>
              <span>{file.source} · {file.createdAt}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
