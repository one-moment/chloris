import { EmptyState } from "./common";

export default function BotRunList({ runs, onCompleteRun, onApproveRun, onRejectRun }) {
  return (
    <div className="panel-section">
      <div className="panel-heading">
        <span>실행 이력</span>
        <small>{runs.length}</small>
      </div>

      <div className="run-list">
        {runs.length === 0 ? (
          <EmptyState title="실행 이력이 없습니다" body="Ideas를 작성한 뒤 채널 목적에 맞는 봇을 실행하세요." />
        ) : (
          runs.map((run) => (
            <article key={run.id} className="run-card">
              <div className="run-header">
                <strong>{run.botName}</strong>
                <span>{run.status}</span>
              </div>
              <p>{run.summary}</p>
              <details>
                <summary>payload 보기</summary>
                <pre>{JSON.stringify(run.payload, null, 2)}</pre>
              </details>
              <div className="run-actions">
                {run.status === "실행중" && <button onClick={() => onCompleteRun(run.id)}>결과 반영</button>}
                {run.approvalStatus === "승인 대기" && (
                  <>
                    <button className="primary-button" onClick={() => onApproveRun(run.id)}>결제 승인</button>
                    <button onClick={() => onRejectRun(run.id)}>반려</button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
