import type { Page } from "playwright";
import type { PurchaseWorkerTask, WorkerResult } from "../client";
import {
  detectHumanRequired,
  ensureNotPaymentStep,
  failedResult,
  humanRequiredResult,
  observedPrice,
  openTaskPage,
  priceLimitResult,
  saveScreenshot
} from "./shared";

export async function runSwadpiaTask(page: Page, task: PurchaseWorkerTask): Promise<WorkerResult> {
  try {
    await openTaskPage(page, task);

    if (await detectHumanRequired(page)) {
      const screenshotPath = await saveScreenshot(page, task, "swadpia-human-required");
      return {
        ...humanRequiredResult("성원애드피아 로그인, 파일 업로드, 옵션 선택 또는 결제정보 입력이 필요해 자동화를 중단했습니다."),
        screenshotPath
      };
    }

    const price = await observedPrice(page);
    const priceGuard = priceLimitResult(task, price);
    if (priceGuard) {
      return {
        ...priceGuard,
        screenshotPath: await saveScreenshot(page, task, "swadpia-price-limit")
      };
    }

    await ensureNotPaymentStep(page);

    return {
      status: "needs_human",
      observedPrice: price,
      screenshotPath: await saveScreenshot(page, task, "swadpia-opened"),
      message: "성원애드피아 반복구매 페이지를 열었습니다. 명함 옵션, 파일, 시안 확인이 필요한 품목이므로 사람이 이어서 진행해야 합니다."
    };
  } catch (error) {
    return {
      ...failedResult(error),
      screenshotPath: await saveScreenshot(page, task, "swadpia-failed").catch(() => undefined)
    };
  }
}
