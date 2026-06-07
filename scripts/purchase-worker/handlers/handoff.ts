import type { PurchaseWorkerTask, WorkerResult } from "../client";
import {
  captureScreenFile,
  executeChromeJavaScript,
  openHumanBrowser,
  screenshotAttachmentFromPath
} from "./shared";

const COUPANG_CART_URL = "https://cart.coupang.com/cartView.pang";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runHandoffTask(task: PurchaseWorkerTask): Promise<WorkerResult> {
  if (task.vendor === "coupang") return runCoupangHandoffTask(task);

  await openHumanBrowser(task.url);

  return {
    status: "needs_human",
    errorCode: "HUMAN_BROWSER_HANDOFF",
    message: [
      "실제 Chrome으로 상품 페이지를 열었습니다.",
      "사람이 장바구니, 주문서, 결제 직전 화면을 직접 확인해야 합니다.",
      "주문서/장바구니 화면은 purchase-worker:capture 명령으로 채널에 기록할 수 있습니다.",
      "최종 결제는 사람이 직접 진행해야 합니다."
    ].join(" ")
  };
}

async function runCoupangHandoffTask(task: PurchaseWorkerTask): Promise<WorkerResult> {
  await openHumanBrowser(task.url);
  await delay(3500);

  let addResult: { clicked?: boolean; quantitySet?: boolean; text?: string; title?: string; url?: string };
  try {
    addResult = JSON.parse(await executeChromeJavaScript(addToCartScript(task.quantity)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "needs_human",
      errorCode: "CHROME_REMOTE_CONTROL_REQUIRED",
      message: [
        "실제 Chrome으로 상품 페이지를 열었지만 장바구니 버튼 원격 조작은 실행하지 못했습니다.",
        "Chrome 메뉴에서 보기 > 개발자 > Apple Events의 자바스크립트 허용을 켠 뒤 다시 실행해주세요.",
        `상세: ${message}`,
        "최종 결제는 사람이 직접 진행해야 합니다."
      ].join(" ")
    };
  }

  if (!addResult.clicked) {
    return {
      status: "needs_human",
      errorCode: "CART_BUTTON_NOT_FOUND",
      message: [
        "실제 Chrome으로 상품 페이지를 열었지만 장바구니 버튼을 찾지 못했습니다.",
        `현재 페이지: ${addResult.title ?? "미확인"}`,
        "사람이 상품/수량을 확인하고 장바구니에 직접 담아주세요.",
        "최종 결제는 사람이 직접 진행해야 합니다."
      ].join(" ")
    };
  }

  await delay(1200);
  await openHumanBrowser(COUPANG_CART_URL);
  await delay(2500);
  const screenshotPath = await captureScreenFile(task.id, "coupang-cart-screen");
  const screenshotAttachment = await screenshotAttachmentFromPath(screenshotPath);

  return {
    status: "cart_ready",
    screenshotPath,
    ...screenshotAttachment,
    errorCode: addResult.quantitySet ? "HUMAN_BROWSER_CART_READY" : "HUMAN_BROWSER_CART_READY_QUANTITY_UNCONFIRMED",
    message: [
      "실제 Chrome에서 장바구니 담기를 시도했고 쿠팡 장바구니 화면을 캡쳐해 소통채널 메시지에 첨부했습니다.",
      addResult.quantitySet ? `${task.quantity}${task.unitLabel} 수량 설정을 시도했습니다.` : "페이지 구조상 수량 설정 여부는 확인하지 못했습니다.",
      "장바구니 수량과 상품을 사람이 확인해야 합니다.",
      "최종 결제는 사람이 직접 진행해야 합니다."
    ].join(" ")
  };
}

function addToCartScript(quantity: number) {
  return `(() => {
    const result = { clicked: false, quantitySet: false, text: "", title: document.title, url: location.href };
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const valueOf = (element) => (
      element.innerText ||
      element.value ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      ""
    ).trim();

    const quantityInput = [...document.querySelectorAll("input, select")]
      .find((element) => visible(element) && /qty|quantity|수량/i.test([element.name, element.id, element.className, element.getAttribute("aria-label")].join(" ")));
    if (quantityInput) {
      quantityInput.value = String(${quantity});
      quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
      quantityInput.dispatchEvent(new Event("change", { bubbles: true }));
      result.quantitySet = true;
    }

    const selectorCandidates = [
      "button.prod-cart-btn",
      ".prod-cart-btn",
      "button[name='cart']",
      "button[class*='cart']",
      "a[class*='cart']",
      "input[class*='cart']"
    ].map((selector) => document.querySelector(selector)).filter(Boolean);

    const textCandidate = [...document.querySelectorAll("button, a, input[type='button'], input[type='submit']")]
      .find((element) => visible(element) && /장바구니|카트|cart/i.test(valueOf(element)));
    const target = selectorCandidates.find(visible) || textCandidate;

    if (!target) return JSON.stringify(result);
    target.scrollIntoView({ block: "center" });
    target.click();
    result.clicked = true;
    result.text = valueOf(target);
    return JSON.stringify(result);
  })()`;
}
