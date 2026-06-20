import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import DisposalDashboard from "../../../../modules/inventory/ui/DisposalDashboard";

export const metadata = {
  title: "폐기 관리 | Chloris"
};

export default function DisposalWorkPage() {
  if (!isModuleEnabled("disposal")) notFound();
  return <DisposalDashboard />;
}
