import { purchaseModule } from "./purchase";

// 모든 업무 모듈은 여기에 매니페스트를 등록한다.
// 모듈 규칙: 모듈은 lib/(core·platform)만 import할 수 있고, 다른 모듈은 import할 수 없다.
// 모듈 간 연계가 필요하면 플랫폼 이벤트를 경유한다 (docs/platform-architecture.md 12절).
export const modules = [purchaseModule];

export function getWorkNavItems(currentUser) {
  return modules
    .filter((module) => module.nav)
    .filter((module) => {
      if (module.nav.minRole === "admin") return currentUser?.role === "admin";
      return true;
    })
    .map((module) => ({ slug: module.slug, ...module.nav }));
}
