import Link from "next/link";

// 폐기 관리 대시보드 (스텁). Phase 3에서 표 입력 폼(키보드 이동·품목 자동완성/검증·
// 구분/폐기원인 드롭다운·4일 lot 자동매핑·임시저장/최종제출)으로 대체된다.
// 설계: docs/inventory-stockin-disposal.md
export default function DisposalDashboard() {
  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>폐기 관리</h1>
          <p>꽃 폐기를 표로 입력하고 입고 lot 원가에 연결합니다. 임시저장 후 최종제출하면 집계됩니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section">
        <p className="work-empty">
          폐기 입력 폼은 준비 중입니다 (Phase 3). 품목 자동완성·저장 시 검증, 구분/폐기원인
          드롭다운, 4일 이내 입고 lot 자동매핑, 임시저장/최종제출을 제공합니다.
        </p>
      </section>
    </div>
  );
}
