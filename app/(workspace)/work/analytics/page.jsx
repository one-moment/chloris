import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import SalesDashboard from "../../../../modules/analytics/ui/SalesDashboard";

export const metadata = {
  title: "통계 | Chloris"
};

export default function AnalyticsWorkPage() {
  if (!isModuleEnabled("analytics")) notFound();
  return <SalesDashboard />;
}
