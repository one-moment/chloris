import { isModuleEnabled } from "../lib/brand";
import { purchaseModule } from "./purchase";
import { crmModule, reservationsModule } from "./crm";
import { disposalModule, stockInModule, inventoryMasterModule } from "./inventory";

// 모든 업무 모듈은 여기에 매니페스트를 등록한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다.
// 모듈 간 연계가 필요하면 플랫폼 이벤트를 경유한다 (docs/platform-architecture.md 12절).
// 회사별로 켜는 모듈은 lib/brand.js 의 ACTIVE_BRAND.modules 가 결정한다.
// (crm·reservations·disposal·stockin 모듈은 보로플라워마켓 전용 — brand 게이팅으로 노출됨.)
const allModules = [purchaseModule, crmModule, reservationsModule, disposalModule, stockInModule, inventoryMasterModule];

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
