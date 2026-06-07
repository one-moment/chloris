import type { Page } from "playwright";
import type { PurchaseWorkerTask, WorkerResult } from "../client";
import {
  clickFirstVisible,
  detectAccessBlocked,
  detectHumanRequired,
  ensureNotPaymentStep,
  failedResult,
  humanRequiredResult,
  observedPrice,
  openTaskPage,
  priceLimitResult,
  saveScreenshot
} from "./shared";

export async function runCoupangTask(page: Page, task: PurchaseWorkerTask): Promise<WorkerResult> {
  try {
    await openTaskPage(page, task);

    if (await detectAccessBlocked(page)) {
      const screenshotPath = await saveScreenshot(page, task, "coupang-access-blocked");
      return {
        ...humanRequiredResult("쿠팡이 자동화 브라우저 접근을 차단했습니다. 사람이 브라우저에서 직접 열어 확인해야 합니다."),
        screenshotPath
      };
    }

    if (await detectHumanRequired(page)) {
      const screenshotPath = await saveScreenshot(page, task, "coupang-human-required");
      return {
        ...humanRequiredResult("쿠팡 로그인, 본인인증, 보안문자 또는 결제정보 입력이 필요해 자동화를 중단했습니다."),
        screenshotPath
      };
    }

    const price = await observedPrice(page);
    const priceGuard = priceLimitResult(task, price);
    if (priceGuard) {
      return {
        ...priceGuard,
        screenshotPath: await saveScreenshot(page, task, "coupang-price-limit")
      };
    }

    if (task.automationLevel === "open_page") {
      return {
        status: "needs_human",
        observedPrice: price,
        screenshotPath: await saveScreenshot(page, task, "coupang-opened"),
        message: "쿠팡 상품 페이지를 열었습니다. 사람이 상품과 수량을 확인한 뒤 직접 진행해야 합니다."
      };
    }

    const cartClicked = await clickFirstVisible(page.getByRole("button", { name: /장바구니|카트/i }));
    if (!cartClicked) {
      return {
        ...humanRequiredResult("쿠팡 장바구니 버튼을 찾지 못했습니다. 상품 URL 또는 페이지 구조를 확인해주세요."),
        observedPrice: price,
        screenshotPath: await saveScreenshot(page, task, "coupang-no-cart-button")
      };
    }

    await page.waitForTimeout(1200);
    await ensureNotPaymentStep(page);

    return {
      status: "cart_ready",
      observedPrice: price,
      screenshotPath: await saveScreenshot(page, task, "coupang-cart-ready"),
      message: "쿠팡 상품을 장바구니에 담는 단계까지 완료했습니다. 최종 주문과 결제는 사람이 직접 진행해야 합니다."
    };
  } catch (error) {
    return {
      ...failedResult(error),
      screenshotPath: await saveScreenshot(page, task, "coupang-failed").catch(() => undefined)
    };
  }
}
