import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../../lib/brand";
import InventoryInsightsDashboard from "../../../../../modules/inventory/ui/InventoryInsightsDashboard";

export const metadata = {
  title: "재고 인사이트 | Chloris"
};

export default function InventoryInsightsWorkPage() {
  if (!isModuleEnabled("inventory-insights")) notFound();
  return <InventoryInsightsDashboard />;
}
