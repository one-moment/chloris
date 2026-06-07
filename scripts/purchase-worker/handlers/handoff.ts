import type { PurchaseWorkerTask, WorkerResult } from "../client";
import {
  activateChromeTabByUrl,
  captureScreenFile,
  executeChromeJavaScript,
  navigateChromeToUrl,
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
  await navigateChromeToUrl(task.url);
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
  await navigateChromeToUrl(COUPANG_CART_URL);
  await delay(2500);
  await activateChromeTabByUrl("cart");
  await delay(700);

  let cartQuantityResult: CartQuantityResult = { quantitySet: false };
  try {
    cartQuantityResult = JSON.parse(await executeChromeJavaScript(adjustCartQuantityScript(task.quantity, task.itemName)));
    await delay(1400);
    const verified = JSON.parse(await executeChromeJavaScript(readCartQuantityScript(task.itemName)));
    cartQuantityResult = { ...cartQuantityResult, verifiedQuantity: verified.quantity };
    if (verified.quantity === task.quantity) cartQuantityResult.quantitySet = true;
  } catch (error) {
    cartQuantityResult = {
      quantitySet: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  const screenshotPath = await captureScreenFile(task.id, "coupang-cart-screen");
  const screenshotAttachment = await screenshotAttachmentFromPath(screenshotPath);
  const quantityMessage = cartQuantityMessage(task, cartQuantityResult);

  return {
    status: cartQuantityResult.quantitySet ? "cart_ready" : "needs_human",
    screenshotPath,
    ...screenshotAttachment,
    observedQuantity: cartQuantityResult.verifiedQuantity,
    errorCode: cartQuantityResult.quantitySet ? "HUMAN_BROWSER_CART_READY" : cartQuantityErrorCode(cartQuantityResult),
    message: [
      "실제 Chrome에서 장바구니 담기를 시도했고 쿠팡 장바구니 화면을 캡쳐해 소통채널 메시지에 첨부했습니다.",
      quantityMessage,
      "장바구니 수량과 상품을 사람이 확인해야 합니다.",
      "최종 결제는 사람이 직접 진행해야 합니다."
    ].join(" ")
  };
}

type CartQuantityResult = {
  quantitySet: boolean;
  targetQuantity?: number;
  initialQuantity?: number;
  verifiedQuantity?: number;
  adjustmentClicks?: number;
  method?: string;
  error?: string;
};

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

function adjustCartQuantityScript(quantity: number, itemName: string) {
  return `(() => {
    const targetQuantity = ${quantity};
    const itemName = ${JSON.stringify(itemName)};
    const result = {
      quantitySet: false,
      targetQuantity,
      initialQuantity: null,
      adjustmentClicks: 0,
      method: ""
    };
    if (!/cart/i.test(location.href)) {
      result.method = "not-cart-page";
      result.url = location.href;
      return JSON.stringify(result);
    }

    const visible = (element) => {
      if (!element || typeof element.getBoundingClientRect !== "function") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const valueOf = (element) => (
      element?.innerText ||
      element?.value ||
      element?.getAttribute?.("aria-label") ||
      element?.getAttribute?.("title") ||
      ""
    ).trim();
    const numericValueOf = (element) => {
      const value = valueOf(element).replace(/[^0-9]/g, "");
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 && parsed < 1000 ? parsed : null;
    };
    const tokenOf = (element) => [
      valueOf(element),
      element?.id,
      element?.name,
      element?.className,
      element?.getAttribute?.("aria-label"),
      element?.getAttribute?.("title")
    ].join(" ").toLowerCase();
    const dispatchInput = (element) => {
      element.focus?.();
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      element.blur?.();
    };
    const setControlValue = (element, value) => {
      const setter = element instanceof HTMLInputElement
        ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        : element instanceof HTMLSelectElement
          ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
          : null;
      if (setter) setter.call(element, String(value));
      else element.value = String(value);
      dispatchInput(element);
    };
    const safeClick = (element) => {
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      element.click();
    };

    const rows = [...document.querySelectorAll("li, tr, .cart-deal-item, .bundle-item, .cart-product, .cart-product-item, .product-unit, .cart-item")]
      .filter((element) => visible(element) && element.innerText?.trim());
    const cartQuantityInput = document.querySelector("input.cart-quantity-input");
    const itemTokens = itemName.toLowerCase().split(/\\s+/).filter(Boolean);
    const targetRow = cartQuantityInput?.closest("[data-component-id='quantity-input']")
      || cartQuantityInput?.parentElement
      || cartQuantityInput?.closest("li, tr, .cart-deal-item, .bundle-item, .cart-product, .cart-product-item, .product-unit, .cart-item")
      || rows.find((row) => itemTokens.some((token) => row.innerText.toLowerCase().includes(token)))
      || rows.find((row) => /수량|원/.test(row.innerText));
    if (!targetRow) {
      result.method = "cart-item-row-not-found";
      return JSON.stringify(result);
    }

    const directControl = cartQuantityInput
      || targetRow.querySelector("input.cart-quantity-input")
      || [...targetRow.querySelectorAll("input, select")]
      .filter(visible)
      .find((element) => {
        const token = tokenOf(element);
        return /qty|quantity|수량|amount|count/.test(token) || numericValueOf(element) !== null;
      });

    const controls = [...targetRow.querySelectorAll("button, a, input[type='button'], input[type='submit'], div[class*='plus-icon'], div[class*='minus-icon']")].filter(visible);
    const isPlus = (element) => {
      const token = tokenOf(element);
      return /^\\+$/.test(valueOf(element)) || /plus|increase|increment|up|add|수량\\s*증가|증가|더하기/.test(token);
    };
    const isMinus = (element) => {
      const token = tokenOf(element);
      return /^[-−]$/.test(valueOf(element)) || /minus|decrease|decrement|down|subtract|수량\\s*감소|감소|빼기/.test(token);
    };
    const isDisabled = (element) => {
      const token = tokenOf(element);
      return element.disabled || element.getAttribute?.("aria-disabled") === "true" || /disabled|disable/.test(token);
    };
    const plusButton = controls.find(isPlus);
    const minusButton = controls.find(isMinus);

    if (directControl) {
      result.initialQuantity = numericValueOf(directControl);
      if (result.initialQuantity === targetQuantity) {
        result.quantitySet = true;
        result.method = "already-target";
        return JSON.stringify(result);
      }
      if (result.initialQuantity !== null && result.initialQuantity < targetQuantity && plusButton && isDisabled(plusButton)) {
        result.quantitySet = false;
        result.method = "plus-disabled";
        result.verifiedQuantity = result.initialQuantity;
        return JSON.stringify(result);
      }
      setControlValue(directControl, targetQuantity);
      result.method = "direct-input";
    }

    const quantityCandidates = [...targetRow.querySelectorAll("span, strong, em, input, select, button")]
      .filter(visible)
      .map((element) => ({ element, value: numericValueOf(element), rect: element.getBoundingClientRect() }))
      .filter((item) => item.value !== null);

    const plusRect = plusButton?.getBoundingClientRect?.();
    const minusRect = minusButton?.getBoundingClientRect?.();
    const nearbyQuantity = quantityCandidates.find((item) => {
      if (!plusRect || !minusRect) return false;
      const centerX = item.rect.left + item.rect.width / 2;
      const centerY = item.rect.top + item.rect.height / 2;
      const left = Math.min(plusRect.left, minusRect.left) - 12;
      const right = Math.max(plusRect.right, minusRect.right) + 12;
      const top = Math.min(plusRect.top, minusRect.top) - 16;
      const bottom = Math.max(plusRect.bottom, minusRect.bottom) + 16;
      return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
    }) || quantityCandidates.find((item) => item.value >= 1 && item.value <= 99);

    const initialQuantity = nearbyQuantity?.value ?? 1;
    result.initialQuantity = initialQuantity;
    const diff = targetQuantity - initialQuantity;
    const button = diff > 0 ? plusButton : minusButton;
    if (button && isDisabled(button)) {
      result.quantitySet = false;
      result.method = diff > 0 ? "plus-disabled" : "minus-disabled";
      result.verifiedQuantity = initialQuantity;
      return JSON.stringify(result);
    }
    if (!button || diff === 0) {
      result.quantitySet = diff === 0;
      result.method = diff === 0 ? "already-target" : "quantity-buttons-not-found";
      return JSON.stringify(result);
    }

    const clicks = Math.min(Math.abs(diff), 50);
    for (let index = 0; index < clicks; index += 1) safeClick(button);
    result.adjustmentClicks = clicks;
    result.quantitySet = true;
    result.method = diff > 0 ? "plus-clicks" : "minus-clicks";
    return JSON.stringify(result);
  })()`;
}

function readCartQuantityScript(itemName: string) {
  return `(() => {
    const itemName = ${JSON.stringify(itemName)};
    if (!/cart/i.test(location.href)) return JSON.stringify({ quantity: null, url: location.href });
    const visible = (element) => {
      if (!element || typeof element.getBoundingClientRect !== "function") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const valueOf = (element) => (
      element?.innerText ||
      element?.value ||
      element?.getAttribute?.("aria-label") ||
      element?.getAttribute?.("title") ||
      ""
    ).trim();
    const numericValueOf = (element) => {
      const value = valueOf(element).replace(/[^0-9]/g, "");
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 && parsed < 1000 ? parsed : null;
    };
    const tokenOf = (element) => [
      valueOf(element),
      element?.id,
      element?.name,
      element?.className,
      element?.getAttribute?.("aria-label"),
      element?.getAttribute?.("title")
    ].join(" ").toLowerCase();
    const rows = [...document.querySelectorAll("li, tr, .cart-deal-item, .bundle-item, .cart-product, .cart-product-item, .product-unit, .cart-item")]
      .filter((element) => visible(element) && element.innerText?.trim());
    const cartQuantityInput = document.querySelector("input.cart-quantity-input");
    const directCartQuantity = numericValueOf(cartQuantityInput);
    if (directCartQuantity !== null) return JSON.stringify({ quantity: directCartQuantity });
    const itemTokens = itemName.toLowerCase().split(/\\s+/).filter(Boolean);
    const targetRow = cartQuantityInput?.closest("[data-component-id='quantity-input']")
      || cartQuantityInput?.parentElement
      || cartQuantityInput?.closest("li, tr, .cart-deal-item, .bundle-item, .cart-product, .cart-product-item, .product-unit, .cart-item")
      || rows.find((row) => itemTokens.some((token) => row.innerText.toLowerCase().includes(token)))
      || rows.find((row) => /수량|원/.test(row.innerText));
    if (!targetRow) return JSON.stringify({ quantity: null });
    const directQuantity = [
      targetRow.querySelector("input.cart-quantity-input"),
      ...targetRow.querySelectorAll("input, select")
    ]
      .filter(visible)
      .map(numericValueOf)
      .find((value) => value !== null);
    if (directQuantity !== undefined) return JSON.stringify({ quantity: directQuantity });

    const controls = [...targetRow.querySelectorAll("button, a, input[type='button'], input[type='submit'], div[class*='plus-icon'], div[class*='minus-icon']")].filter(visible);
    const plusButton = controls.find((element) => /^\\+$/.test(valueOf(element)) || /plus|increase|increment|up|add|수량\\s*증가|증가|더하기/.test(tokenOf(element)));
    const minusButton = controls.find((element) => /^[-−]$/.test(valueOf(element)) || /minus|decrease|decrement|down|subtract|수량\\s*감소|감소|빼기/.test(tokenOf(element)));
    const plusRect = plusButton?.getBoundingClientRect?.();
    const minusRect = minusButton?.getBoundingClientRect?.();
    const candidates = [...targetRow.querySelectorAll("span, strong, em, input, select, button")]
      .filter(visible)
      .map((element) => ({ value: numericValueOf(element), rect: element.getBoundingClientRect() }))
      .filter((item) => item.value !== null);
    const nearby = candidates.find((item) => {
      if (!plusRect || !minusRect) return false;
      const centerX = item.rect.left + item.rect.width / 2;
      const centerY = item.rect.top + item.rect.height / 2;
      const left = Math.min(plusRect.left, minusRect.left) - 12;
      const right = Math.max(plusRect.right, minusRect.right) + 12;
      const top = Math.min(plusRect.top, minusRect.top) - 16;
      const bottom = Math.max(plusRect.bottom, minusRect.bottom) + 16;
      return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
    }) || candidates.find((item) => item.value >= 1 && item.value <= 99);
    return JSON.stringify({ quantity: nearby?.value ?? null });
  })()`;
}

function cartQuantityMessage(task: PurchaseWorkerTask, result: CartQuantityResult) {
  if (result.quantitySet && result.verifiedQuantity === task.quantity) {
    return `장바구니 수량을 ${task.quantity}${task.unitLabel}로 맞췄습니다.`;
  }
  if (result.verifiedQuantity) {
    return `장바구니 수량 보정을 시도했지만 감지된 수량은 ${result.verifiedQuantity}${task.unitLabel}입니다. 목표 수량은 ${task.quantity}${task.unitLabel}입니다.`;
  }
  if (result.initialQuantity && result.adjustmentClicks) {
    return `장바구니 수량 보정을 ${result.adjustmentClicks}회 시도했습니다. 목표 수량은 ${task.quantity}${task.unitLabel}입니다.`;
  }
  return "페이지 구조상 장바구니 수량 설정 여부는 확인하지 못했습니다.";
}

function cartQuantityErrorCode(result: CartQuantityResult) {
  if (result.method === "plus-disabled") return "CART_QUANTITY_LIMIT_OR_DISABLED";
  if (result.method === "not-cart-page") return "CART_PAGE_NOT_ACTIVE";
  if (result.method === "cart-item-row-not-found") return "CART_ITEM_ROW_NOT_FOUND";
  return "CART_QUANTITY_UNCONFIRMED";
}
