import { notFound } from "next/navigation";
import { isModuleEnabled } from "../../../../lib/brand";
import BranchManagerAdmin from "../../../../components/BranchManagerAdmin";

export const metadata = {
  title: "지점 매니저 | Chloris"
};

// 코어 admin 화면 — 보로 게이팅(의사 슬러그 "branch-admin"). 권한은 하위 API 가 admin 가드로 강제.
export default function BranchManagersWorkPage() {
  if (!isModuleEnabled("branch-admin")) notFound();
  return <BranchManagerAdmin />;
}
