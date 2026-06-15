import Link from "next/link";

// 입고 관리 대시보드 (스텁). Phase 4에서 입고 표(발주/영수증/실입고 3중 대조·lotId 자동
// 발번·거래명세서 OCR 사전채움)로 대체된다. 설계: docs/inventory-stockin-disposal.md
export default function StockInDashboard() {
  return (
    <div className="work-page">
      <header className="work-page-header">
        <div>
          <h1>입고 관리</h1>
          <p>거래명세서를 표로 입력하면 각 행이 lot이 되어 폐기 원가 매핑의 기준이 됩니다.</p>
        </div>
        <Link className="ghost-button" href="/">← 채팅으로</Link>
      </header>

      <section className="work-section">
        <p className="work-empty">
          입고 입력 폼은 준비 중입니다 (Phase 4). 발주/영수증/실입고 3중 대조, lotId 자동 발번,
          거래명세서 사진 자동인식(OCR) 사전채움을 제공합니다.
        </p>
      </section>
    </div>
  );
}
