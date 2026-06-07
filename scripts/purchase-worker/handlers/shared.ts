import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { config } from "../config";
import type { PurchaseWorkerTask, WorkerResult } from "../client";

const PAYMENT_BUTTON_TEXT = /(결제|결제하기|주문\s*완료|최종\s*주문|place\s*order|pay\s*now)/i;
const HUMAN_REQUIRED_TEXT = /(로그인|본인인증|휴대폰\s*인증|captcha|보안문자|2단계|two-factor|otp|카드번호|cvc|cvv|결제수단)/i;
const ACCESS_BLOCKED_TEXT = /(access denied|permission to access|errors\.edgesuite\.net|접근\s*거부)/i;
const PRICE_PATTERN = /([0-9][0-9,]{2,})\s*원/g;

export async function openTaskPage(page: Page, task: PurchaseWorkerTask) {
  await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null);
}

export async function detectHumanRequired(page: Page) {
  const text = await readBodyText(page);
  return HUMAN_REQUIRED_TEXT.test(text);
}

export async function detectAccessBlocked(page: Page) {
  const text = await readBodyText(page);
  return ACCESS_BLOCKED_TEXT.test(text);
}

export async function ensureNotPaymentStep(page: Page) {
  const paymentButtons = await page.getByRole("button", { name: PAYMENT_BUTTON_TEXT }).count().catch(() => 0);
  const paymentLinks = await page.getByRole("link", { name: PAYMENT_BUTTON_TEXT }).count().catch(() => 0);
  if (paymentButtons > 0 || paymentLinks > 0) {
    throw new Error("SAFETY_PAYMENT_STEP_DETECTED");
  }
}

export async function saveScreenshot(page: Page, task: PurchaseWorkerTask, label: string) {
  await mkdir(config.screenshotDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(config.screenshotDir, `${timestamp}-${task.id}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

export async function observedPrice(page: Page) {
  const text = await readBodyText(page);
  const prices = [...text.matchAll(PRICE_PATTERN)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  return prices.length > 0 ? Math.min(...prices) : undefined;
}

export function priceLimitResult(task: PurchaseWorkerTask, price?: number): WorkerResult | null {
  if (!price || !task.maxAllowedPrice || price <= task.maxAllowedPrice) return null;
  return {
    status: "needs_human",
    observedPrice: price,
    errorCode: "PRICE_LIMIT_EXCEEDED",
    message: `확인된 가격 ${price.toLocaleString("ko-KR")}원이 상한 ${task.maxAllowedPrice.toLocaleString("ko-KR")}원을 초과해 중단했습니다.`
  };
}

export async function clickFirstVisible(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ timeout: 10000 });
      return true;
    }
  }
  return false;
}

export function humanRequiredResult(message: string): WorkerResult {
  return {
    status: "needs_human",
    errorCode: "HUMAN_REQUIRED",
    message
  };
}

export function failedResult(error: unknown): WorkerResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "failed",
    errorCode: message === "SAFETY_PAYMENT_STEP_DETECTED" ? "SAFETY_PAYMENT_STEP_DETECTED" : "WORKER_ERROR",
    message
  };
}

async function readBodyText(page: Page) {
  return page.locator("body").innerText({ timeout: 8000 }).catch(() => "");
}
