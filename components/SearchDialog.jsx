import { useState } from "react";
import Timestamp from "./Timestamp";

export default function SearchDialog({ requestJson, onNavigate, onClose }) {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  async function search(event) {
    event?.preventDefault();
    if (!query.trim() && !author.trim() && !from && !to) {
      setError("검색어, 작성자, 기간 중 하나 이상을 입력하세요.");
      return;
    }
    setError("");
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (author.trim()) params.set("author", author.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await requestJson(`/api/search?${params.toString()}`);
      setResults(data);
    } catch (searchError) {
      console.error(searchError);
      setError(searchError.message);
    } finally {
      setIsSearching(false);
    }
  }

  function openResult(item) {
    onNavigate({
      projectId: item.projectId,
      channelId: item.channelId,
      tab: item.type === "post" ? "ideas" : "messages"
    });
    onClose();
  }

  const items = results ? [...results.posts, ...results.messages].sort(
    (a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso)
  ) : null;

  return (
    <div className="next-dialog-fallback" onClick={onClose}>
      <section
        className="modal-card search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="검색"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="search-form" onSubmit={search}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="검색어 (@멘션 검색 가능)"
            autoFocus
          />
          <div className="search-filters">
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="작성자"
            />
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="시작일" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="종료일" />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>닫기</button>
            <button className="primary-button" type="submit" disabled={isSearching}>
              {isSearching ? "검색 중" : "검색"}
            </button>
          </div>
        </form>

        {error && <p className="action-error">{error}</p>}

        {items && (
          <div className="search-results">
            {items.length === 0 ? (
              <p className="search-empty">검색 결과가 없습니다.</p>
            ) : (
              items.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="search-result"
                  type="button"
                  onClick={() => openResult(item)}
                >
                  <span className="search-result-meta">
                    <span className={`search-result-type ${item.type}`}>{item.type === "post" ? "게시글" : "메시지"}</span>
                    <strong>{item.author}</strong>
                    <span># {item.channelName}</span>
                    <Timestamp createdAt={item.createdAtIso} />
                  </span>
                  {item.title && <strong className="search-result-title">{item.title}</strong>}
                  <span className="search-result-snippet">{item.snippet}</span>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
