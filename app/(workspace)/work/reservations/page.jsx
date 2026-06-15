import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import ReservationsDashboard from "../../../../modules/crm/ui/ReservationsDashboard";

export const metadata = {
  title: "예약 관리 | Chloris"
};

export default function ReservationsWorkPage() {
  if (!isModuleEnabled("reservations")) notFound();
  return <ReservationsDashboard />;
}
