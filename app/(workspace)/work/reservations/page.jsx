import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import ReservationsDashboard from "../../../../modules/crm/ui/ReservationsDashboard";

export const metadata = {
  title: "예약 관리 | Chloris"
};

export default async function ReservationsWorkPage({ searchParams }) {
  if (!isModuleEnabled("reservations")) notFound();
  const params = (await searchParams) ?? {};
  const str = (value) => (typeof value === "string" && value ? value : undefined);
  // 3단계: 헤르메스 미리채움(비PII만). 성함·연락처는 URL로 받지 않는다.
  const prefill = {
    product: str(params.product),
    amount: str(params.amount),
    pickup: str(params.pickup),
    receive: str(params.receive),
    source: str(params.source)
  };
  return (
    <ReservationsDashboard
      initialNew={params.new === "1"}
      initialChannelId={typeof params.channel === "string" ? params.channel : null}
      initialBranchId={typeof params.branch === "string" ? params.branch : ""}
      initialPrefill={prefill}
    />
  );
}
