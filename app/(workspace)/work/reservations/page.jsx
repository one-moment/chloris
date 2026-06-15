import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import ReservationsDashboard from "../../../../modules/crm/ui/ReservationsDashboard";

export const metadata = {
  title: "예약 관리 | Chloris"
};

export default async function ReservationsWorkPage({ searchParams }) {
  if (!isModuleEnabled("reservations")) notFound();
  const params = (await searchParams) ?? {};
  return (
    <ReservationsDashboard
      initialNew={params.new === "1"}
      initialChannelId={typeof params.channel === "string" ? params.channel : null}
      initialBranchId={typeof params.branch === "string" ? params.branch : ""}
    />
  );
}
