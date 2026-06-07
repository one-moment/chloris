import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Locator, Page } from "playwright";
import { config } from "../config";
import type { PurchaseWorkerTask, WorkerResult } from "../client";

const execFileAsync = promisify(execFile);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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

export async function captureScreenFile(taskId: string, label: string) {
  await mkdir(config.screenshotDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(config.screenshotDir, `${timestamp}-${taskId}-${label}.png`);

  if (process.platform !== "darwin") {
    throw new Error("Screen capture currently supports macOS only.");
  }

  const browserRegion = await activateBrowserAndGetRegion();
  if (browserRegion) {
    await delay(700);
    await execFileAsync("screencapture", ["-x", "-R", browserRegion, screenshotPath]);
    return screenshotPath;
  }

  await execFileAsync("osascript", ["-e", `tell application ${JSON.stringify(config.handoffBrowser)} to activate`]).catch(() => null);
  await delay(700);
  await execFileAsync("screencapture", ["-x", screenshotPath]);
  return screenshotPath;
}

async function activateBrowserAndGetRegion() {
  const script = [
    `tell application ${JSON.stringify(config.handoffBrowser)}`,
    "activate",
    "set windowBounds to bounds of front window",
    "return (item 1 of windowBounds as text) & \",\" & (item 2 of windowBounds as text) & \",\" & (item 3 of windowBounds as text) & \",\" & (item 4 of windowBounds as text)",
    "end tell"
  ];

  const { stdout } = await execFileAsync("osascript", script.flatMap((line) => ["-e", line])).catch(() => ({ stdout: "" }));
  const [left, top, right, bottom] = stdout.trim().split(",").map((value) => Number(value));
  if (![left, top, right, bottom].every((value) => Number.isFinite(value))) return null;

  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  return `${left},${top},${width},${height}`;
}

export async function screenshotAttachmentFromPath(screenshotPath: string) {
  const [bytes, fileStat] = await Promise.all([
    readFile(screenshotPath),
    stat(screenshotPath)
  ]);
  return {
    screenshotDataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    screenshotName: path.basename(screenshotPath),
    screenshotType: "image/png",
    screenshotSize: fileStat.size
  };
}

export async function openHumanBrowser(url: string) {
  if (process.platform === "darwin") {
    await execFileAsync("open", ["-a", config.handoffBrowser, url]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }

  await execFileAsync("xdg-open", [url]);
}

export async function executeChromeJavaScript(script: string) {
  if (process.platform !== "darwin") {
    throw new Error("Chrome JavaScript handoff currently supports macOS only.");
  }

  const { stdout } = await execFileAsync("osascript", [
    "-e", "tell application \"Google Chrome\"",
    "-e", "activate",
    "-e", `set scriptResult to execute active tab of front window javascript ${JSON.stringify(script)}`,
    "-e", "return scriptResult",
    "-e", "end tell"
  ]);
  return stdout.trim();
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
