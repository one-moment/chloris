import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import StockInDashboard from "../../../../modules/inventory/ui/StockInDashboard";

export const metadata = {
  title: "입고 관리 | Chloris"
};

export default function StockInWorkPage() {
  if (!isModuleEnabled("stockin")) notFound();
  return <StockInDashboard />;
}
