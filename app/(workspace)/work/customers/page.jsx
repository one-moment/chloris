import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import CustomersDashboard from "../../../../modules/crm/ui/CustomersDashboard";

export const metadata = {
  title: "고객 관리 | Chloris"
};

export default function CustomersWorkPage() {
  if (!isModuleEnabled("crm")) notFound();
  return <CustomersDashboard />;
}
