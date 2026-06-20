import { isModuleEnabled } from "../lib/brand";
import { purchaseModule } from "./purchase";
import { crmModule, reservationsModule } from "./crm";
import { disposalModule, stockInModule, inventoryMasterModule, inventoryInsightsModule } from "./inventory";
import { analyticsModule } from "./analytics";

// 모든 업무 모듈은 여기에 매니페스트를 등록한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다.
// 모듈 간 연계가 필요하면 플랫폼 이벤트를 경유한다 (docs/platform-architecture.md 12절).
// 회사별로 켜는 모듈은 lib/brand.js 의 ACTIVE_BRAND.modules 가 결정한다.
// (crm·reservations·disposal·stockin 모듈은 보로플라워마켓 전용 — brand 게이팅으로 노출됨.)
// (analytics 모듈은 원모먼트 전용 — brand 게이팅으로 노출됨.)
const allModules = [purchaseModule, crmModule, reservationsModule, disposalModule, stockInModule, inventoryMasterModule, inventoryInsightsModule, analyticsModule];

export const modules = allModules.filter((module) => isModuleEnabled(module.slug));

export function getWorkNavItems(currentUser) {
  return modules
    .filter((module) => module.nav)
    .filter((module) => {
      if (module.nav.minRole === "admin") return currentUser?.role === "admin";
      return true;
    })
    .map((module) => ({ slug: module.slug, ...module.nav }));
}

// 액션형 멘션 컨트랙트(@예약 등)를 코어 작성기에 데이터로 노출한다.
// 코어(components/MentionInput.jsx의 부모 작성기)가 이 함수를 호출해 후보를 받고,
// 선택 시 텍스트 삽입 대신 반환된 href로 라우팅한다. 코어는 modules/를 직접 import하지 않는다.
// modules는 이미 brand 게이팅(isModuleEnabled)으로 필터돼 있어 비활성 모듈 액션은 빠진다.
export function getMentionActions(currentUser, channel) {
  if (!channel) return [];
  return modules
    .flatMap((module) => module.mentionActions ?? [])
    .filter((action) => {
      if (action.minRole === "admin") return currentUser?.role === "admin";
      return Boolean(currentUser);
    })
    .filter((action) => !action.requiresBranch || Boolean(channel.branchId))
    .map((action) => ({
      token: action.token,
      label: action.label,
      description: action.description ?? "",
      href: typeof action.hrefFor === "function" ? action.hrefFor(channel) : null
    }))
    .filter((action) => Boolean(action.href));
}
