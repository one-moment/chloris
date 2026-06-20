import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../../lib/brand";
import InventoryMastersDashboard from "../../../../../modules/inventory/ui/InventoryMastersDashboard";

export const metadata = {
  title: "재고 마스터 | Chloris"
};

export default function InventoryMastersWorkPage() {
  if (!isModuleEnabled("inventory-master")) notFound();
  return <InventoryMastersDashboard />;
}
