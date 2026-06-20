import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PurchaseWorkerTask, WorkerResult } from "../client";
import { config } from "../config";
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
    cartQuantityResult = JSON.parse(await executeChromeJavaScript(adjustCartQuantityScript(task.quantity, task.itemName, task.url)));
    await delay(cartQuantityVerificationDelay(cartQuantityResult));
    const verified = JSON.parse(await executeChromeJavaScript(readCartQuantityScript(task.itemName, task.url)));
    cartQuantityResult = {
      ...cartQuantityResult,
      verifiedQuantity: verified.quantity,
      verifiedDebug: verified.debug
    };
    if (verified.quantity === task.quantity) cartQuantityResult.quantitySet = true;
  } catch (error) {
    cartQuantityResult = {
      quantitySet: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  cartQuantityResult.debugArtifactPath = await saveCartDebugArtifact(task, cartQuantityResult).catch((error) => {
    console.error(`[purchase-worker] failed to save cart debug artifact: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });

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
  debug?: CartDebugInfo;
  verifiedDebug?: CartDebugInfo;
  debugArtifactPath?: string;
};

type CartDebugInfo = {
  url?: string;
  title?: string;
  selectorLogs?: Array<{
    name: string;
    selector?: string;
    matchCount?: number;
    chosenIndex?: number;
    note?: string;
  }>;
  targetRowText?: string;
  targetRowHtml?: string;
  targetRowRect?: { left: number; top: number; width: number; height: number };
  cartItemCount?: number;
  quantityControlCount?: number;
  controlsCount?: number;
  rowSummaries?: Array<{
    index: number;
    score: number;
    text: string;
    hrefs: string[];
    quantityControlCount: number;
  }>;
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

function adjustCartQuantityScript(quantity: number, itemName: string, itemUrl: string) {
  return `(() => {
    const targetQuantity = ${quantity};
    const itemName = ${JSON.stringify(itemName)};
    const itemUrl = ${JSON.stringify(itemUrl)};
    const result = {
      quantitySet: false,
      targetQuantity,
      initialQuantity: null,
      adjustmentClicks: 0,
      method: "",
      debug: {
        url: location.href,
        title: document.title,
        selectorLogs: [],
        rowSummaries: []
      }
    };
    const logSelector = (entry) => result.debug.selectorLogs.push(entry);
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
    const quantityValueOf = (element) => {
      if (!element) return null;
      const rawValue = element instanceof HTMLInputElement || element instanceof HTMLSelectElement
        ? element.value
        : element.getAttribute?.("aria-valuenow") || element.getAttribute?.("data-quantity") || "";
      const value = String(rawValue).replace(/[^0-9]/g, "");
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
    const cleanText = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    const parseUrlIdentifiers = (url) => {
      try {
        const parsed = new URL(url);
        return [
          parsed.pathname.match(/\\/products\\/(\\d+)/)?.[1],
          parsed.searchParams.get("itemId"),
          parsed.searchParams.get("vendorItemId")
        ].filter(Boolean);
      } catch {
        return [];
      }
    };
    const rowSelector = [
      "li",
      "tr",
      ".cart-deal-item",
      ".bundle-item",
      ".cart-product",
      ".cart-product-item",
      ".product-unit",
      ".cart-item",
      "[id^='item_']",
      "[data-vid]",
      "[data-bundle-id]"
    ].join(", ");
    const quantityControlSelector = [
      "input.cart-quantity-input",
      "input[name*='quantity']",
      "input[id*='quantity']",
      "input[class*='quantity']",
      "input[aria-label*='수량']",
      "select[name*='quantity']",
      "select[id*='quantity']",
      "select[class*='quantity']",
      "select[aria-label*='수량']"
    ].join(", ");
    const itemTokens = itemName.toLowerCase().split(/\\s+/).filter((token) => token.length >= 2);
    const urlIdentifiers = parseUrlIdentifiers(itemUrl);
    const quantityControls = [...document.querySelectorAll(quantityControlSelector)].filter(visible);
    logSelector({ name: "page.quantityControls", selector: quantityControlSelector, matchCount: quantityControls.length });

    const rows = [...document.querySelectorAll(rowSelector)]
      .filter((element) => visible(element) && element.innerText?.trim());
    logSelector({ name: "page.cartRows", selector: rowSelector, matchCount: rows.length });
    result.debug.cartItemCount = rows.length;
    result.debug.quantityControlCount = quantityControls.length;
    const scoreRow = (row) => {
      const text = cleanText(row.innerText).toLowerCase();
      const hrefs = [...row.querySelectorAll("a[href]")].map((link) => link.href || link.getAttribute("href") || "");
      const attributes = [
        row.id,
        row.getAttribute("data-vid"),
        row.getAttribute("data-bundle-id"),
        row.getAttribute("data-item-id")
      ].filter(Boolean).join(" ");
      const tokenScore = itemTokens.reduce((score, token) => score + (text.includes(token) ? 2 : 0), 0);
      const hrefScore = urlIdentifiers.reduce((score, id) => score + (hrefs.some((href) => href.includes(id)) ? 4 : 0), 0);
      const attributeScore = urlIdentifiers.reduce((score, id) => score + (attributes.includes(id) ? 5 : 0), 0);
      const controlScore = row.querySelectorAll(quantityControlSelector).length > 0 ? 10 : 0;
      const recommendationPenalty = hrefs.some((href) => /cart_also_bought|recommendation/i.test(href)) && controlScore === 0 ? 8 : 0;
      return tokenScore + hrefScore + attributeScore + controlScore - recommendationPenalty;
    };
    const rowScores = rows
      .map((row, index) => ({ row, index, score: scoreRow(row) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    result.debug.rowSummaries = rowScores.slice(0, 8).map(({ row, index, score }) => ({
      index,
      score,
      text: cleanText(row.innerText).slice(0, 260),
      hrefs: [...row.querySelectorAll("a[href]")].map((link) => link.href || link.getAttribute("href") || "").slice(0, 3),
      quantityControlCount: row.querySelectorAll(quantityControlSelector).length
    }));

    let selected = rowScores.find((item) => item.score >= 3);
    if (!selected && quantityControls.length === 1) {
      const row = quantityControls[0].closest(rowSelector);
      if (row) selected = { row, index: rows.indexOf(row), score: 1 };
      logSelector({ name: "fallback.singleQuantityControlRow", chosenIndex: selected?.index ?? -1, note: "Used only because exactly one quantity control was visible." });
    }
    const targetRow = selected?.row;
    if (!targetRow) {
      result.method = "cart-item-row-not-found";
      return JSON.stringify(result);
    }
    logSelector({ name: "target.row", chosenIndex: selected.index, note: \`score=\${selected.score}\` });
    result.debug.targetRowText = cleanText(targetRow.innerText).slice(0, 1000);
    result.debug.targetRowHtml = targetRow.outerHTML;
    const targetRect = targetRow.getBoundingClientRect();
    result.debug.targetRowRect = {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height
    };

    const rowQuantityControls = [...targetRow.querySelectorAll(quantityControlSelector)].filter(visible);
    logSelector({ name: "targetRow.quantityControls", selector: quantityControlSelector, matchCount: rowQuantityControls.length, chosenIndex: rowQuantityControls.length > 0 ? 0 : -1 });
    const directControl = rowQuantityControls[0]
      || [...targetRow.querySelectorAll("input, select")]
      .filter(visible)
      .find((element) => {
        const token = tokenOf(element);
        return /qty|quantity|수량|amount|count/.test(token) || quantityValueOf(element) !== null;
      });

    const quantityButtonSelector = "button, a, input[type='button'], input[type='submit'], div[class*='plus-icon'], div[class*='minus-icon']";
    const controls = [...targetRow.querySelectorAll(quantityButtonSelector)].filter(visible);
    result.debug.controlsCount = controls.length;
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
    const plusIndex = controls.findIndex(isPlus);
    const minusIndex = controls.findIndex(isMinus);
    const plusButton = plusIndex >= 0 ? controls[plusIndex] : null;
    const minusButton = minusIndex >= 0 ? controls[minusIndex] : null;
    logSelector({ name: "targetRow.quantityButtons", selector: quantityButtonSelector, matchCount: controls.length });
    logSelector({ name: "targetRow.plusButton", chosenIndex: plusIndex });
    logSelector({ name: "targetRow.minusButton", chosenIndex: minusIndex });

    if (directControl) {
      result.initialQuantity = quantityValueOf(directControl);
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
      return JSON.stringify(result);
    }

    result.quantitySet = false;
    result.method = "quantity-control-not-found";
    return JSON.stringify(result);
  })()`;
}

function readCartQuantityScript(itemName: string, itemUrl: string) {
  return `(() => {
    const itemName = ${JSON.stringify(itemName)};
    const itemUrl = ${JSON.stringify(itemUrl)};
    const debug = {
      url: location.href,
      title: document.title,
      selectorLogs: [],
      rowSummaries: []
    };
    const logSelector = (entry) => debug.selectorLogs.push(entry);
    if (!/cart/i.test(location.href)) return JSON.stringify({ quantity: null, url: location.href, debug });
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
    const quantityValueOf = (element) => {
      if (!element) return null;
      const rawValue = element instanceof HTMLInputElement || element instanceof HTMLSelectElement
        ? element.value
        : element.getAttribute?.("aria-valuenow") || element.getAttribute?.("data-quantity") || "";
      const value = String(rawValue).replace(/[^0-9]/g, "");
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 && parsed < 1000 ? parsed : null;
    };
    const cleanText = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    const parseUrlIdentifiers = (url) => {
      try {
        const parsed = new URL(url);
        return [
          parsed.pathname.match(/\\/products\\/(\\d+)/)?.[1],
          parsed.searchParams.get("itemId"),
          parsed.searchParams.get("vendorItemId")
        ].filter(Boolean);
      } catch {
        return [];
      }
    };
    const rowSelector = [
      "li",
      "tr",
      ".cart-deal-item",
      ".bundle-item",
      ".cart-product",
      ".cart-product-item",
      ".product-unit",
      ".cart-item",
      "[id^='item_']",
      "[data-vid]",
      "[data-bundle-id]"
    ].join(", ");
    const quantityControlSelector = [
      "input.cart-quantity-input",
      "input[name*='quantity']",
      "input[id*='quantity']",
      "input[class*='quantity']",
      "input[aria-label*='수량']",
      "select[name*='quantity']",
      "select[id*='quantity']",
      "select[class*='quantity']",
      "select[aria-label*='수량']"
    ].join(", ");
    const quantityControls = [...document.querySelectorAll(quantityControlSelector)].filter(visible);
    logSelector({ name: "page.quantityControls", selector: quantityControlSelector, matchCount: quantityControls.length });
    const rows = [...document.querySelectorAll(rowSelector)]
      .filter((element) => visible(element) && element.innerText?.trim());
    logSelector({ name: "page.cartRows", selector: rowSelector, matchCount: rows.length });
    debug.cartItemCount = rows.length;
    debug.quantityControlCount = quantityControls.length;
    const itemTokens = itemName.toLowerCase().split(/\\s+/).filter((token) => token.length >= 2);
    const urlIdentifiers = parseUrlIdentifiers(itemUrl);
    const scoreRow = (row) => {
      const text = cleanText(row.innerText).toLowerCase();
      const hrefs = [...row.querySelectorAll("a[href]")].map((link) => link.href || link.getAttribute("href") || "");
      const attributes = [
        row.id,
        row.getAttribute("data-vid"),
        row.getAttribute("data-bundle-id"),
        row.getAttribute("data-item-id")
      ].filter(Boolean).join(" ");
      const tokenScore = itemTokens.reduce((score, token) => score + (text.includes(token) ? 2 : 0), 0);
      const hrefScore = urlIdentifiers.reduce((score, id) => score + (hrefs.some((href) => href.includes(id)) ? 4 : 0), 0);
      const attributeScore = urlIdentifiers.reduce((score, id) => score + (attributes.includes(id) ? 5 : 0), 0);
      const controlScore = row.querySelectorAll(quantityControlSelector).length > 0 ? 10 : 0;
      const recommendationPenalty = hrefs.some((href) => /cart_also_bought|recommendation/i.test(href)) && controlScore === 0 ? 8 : 0;
      return tokenScore + hrefScore + attributeScore + controlScore - recommendationPenalty;
    };
    const rowScores = rows
      .map((row, index) => ({ row, index, score: scoreRow(row) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    debug.rowSummaries = rowScores.slice(0, 8).map(({ row, index, score }) => ({
      index,
      score,
      text: cleanText(row.innerText).slice(0, 260),
      hrefs: [...row.querySelectorAll("a[href]")].map((link) => link.href || link.getAttribute("href") || "").slice(0, 3),
      quantityControlCount: row.querySelectorAll(quantityControlSelector).length
    }));

    let selected = rowScores.find((item) => item.score >= 3);
    if (!selected && quantityControls.length === 1) {
      const row = quantityControls[0].closest(rowSelector);
      if (row) selected = { row, index: rows.indexOf(row), score: 1 };
      logSelector({ name: "fallback.singleQuantityControlRow", chosenIndex: selected?.index ?? -1, note: "Used only because exactly one quantity control was visible." });
    }
    const targetRow = selected?.row;
    if (!targetRow) return JSON.stringify({ quantity: null, debug });
    logSelector({ name: "target.row", chosenIndex: selected.index, note: \`score=\${selected.score}\` });
    debug.targetRowText = cleanText(targetRow.innerText).slice(0, 1000);
    debug.targetRowHtml = targetRow.outerHTML;
    const targetRect = targetRow.getBoundingClientRect();
    debug.targetRowRect = {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height
    };
    const rowQuantityControls = [...targetRow.querySelectorAll(quantityControlSelector)].filter(visible);
    logSelector({ name: "targetRow.quantityControls", selector: quantityControlSelector, matchCount: rowQuantityControls.length, chosenIndex: rowQuantityControls.length > 0 ? 0 : -1 });
    const directQuantity = rowQuantityControls.map(quantityValueOf).find((value) => value !== null);
    return JSON.stringify({ quantity: directQuantity ?? null, debug });
  })()`;
}

function cartQuantityVerificationDelay(result: CartQuantityResult) {
  const clicks = result.adjustmentClicks ?? 0;
  if (result.method?.startsWith("scheduled-")) return Math.min(9000, 1000 + clicks * 220);
  return 1400;
}

async function saveCartDebugArtifact(task: PurchaseWorkerTask, result: CartQuantityResult) {
  if (result.quantitySet) return undefined;

  await mkdir(config.debugDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${timestamp}-${task.id}-coupang-cart-debug`;
  const summaryPath = path.join(config.debugDir, `${baseName}.json`);
  const rowHtmlPath = path.join(config.debugDir, `${baseName}-row.html`);
  const pageHtmlPath = path.join(config.debugDir, `${baseName}-page.html`);

  const rowHtml = result.verifiedDebug?.targetRowHtml ?? result.debug?.targetRowHtml;
  if (rowHtml) {
    await writeFile(rowHtmlPath, rowHtml, "utf8");
  }

  let capturedPageHtml = false;
  let pageHtmlError: string | undefined;
  try {
    const pageHtml = await executeChromeJavaScript("document.documentElement.outerHTML");
    await writeFile(pageHtmlPath, pageHtml, "utf8");
    capturedPageHtml = true;
  } catch (error) {
    pageHtmlError = error instanceof Error ? error.message : String(error);
  }

  const summary = {
    task: {
      id: task.id,
      purchaseRequestId: task.purchaseRequestId,
      vendor: task.vendor,
      itemName: task.itemName,
      targetQuantity: task.quantity,
      unitLabel: task.unitLabel,
      url: task.url
    },
    result: {
      quantitySet: result.quantitySet,
      targetQuantity: result.targetQuantity,
      initialQuantity: result.initialQuantity,
      verifiedQuantity: result.verifiedQuantity,
      adjustmentClicks: result.adjustmentClicks,
      method: result.method,
      error: result.error
    },
    debug: {
      adjust: scrubDebugHtml(result.debug),
      verify: scrubDebugHtml(result.verifiedDebug),
      rowHtmlPath: rowHtml ? rowHtmlPath : null,
      pageHtmlPath: capturedPageHtml ? pageHtmlPath : null,
      pageHtmlError
    },
    environment: {
      mode: config.serverUrl.includes("localhost") || config.serverUrl.includes("127.0.0.1") ? "local" : "production",
      handoffBrowser: config.handoffBrowser,
      os: process.platform,
      nodeVersion: process.version,
      headless: false
    }
  };

  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  return summaryPath;
}

function scrubDebugHtml(debug?: CartDebugInfo) {
  if (!debug) return undefined;
  const { targetRowHtml, ...rest } = debug;
  return {
    ...rest,
    targetRowHtmlLength: targetRowHtml?.length ?? 0
  };
}

function cartQuantityMessage(task: PurchaseWorkerTask, result: CartQuantityResult) {
  if (result.quantitySet && result.verifiedQuantity === task.quantity) {
    return `장바구니 수량을 ${task.quantity}${task.unitLabel}로 맞췄습니다.`;
  }
  if (result.verifiedQuantity) {
    return [
      `장바구니 수량 보정을 시도했지만 감지된 수량은 ${result.verifiedQuantity}${task.unitLabel}입니다. 목표 수량은 ${task.quantity}${task.unitLabel}입니다.`,
      result.debugArtifactPath ? `디버그 자료: ${result.debugArtifactPath}` : null
    ].filter(Boolean).join(" ");
  }
  if (result.initialQuantity && result.adjustmentClicks) {
    return [
      `장바구니 수량 보정을 ${result.adjustmentClicks}회 시도했습니다. 목표 수량은 ${task.quantity}${task.unitLabel}입니다.`,
      result.debugArtifactPath ? `디버그 자료: ${result.debugArtifactPath}` : null
    ].filter(Boolean).join(" ");
  }
  return [
    "페이지 구조상 장바구니 수량 설정 여부는 확인하지 못했습니다.",
    result.debugArtifactPath ? `디버그 자료: ${result.debugArtifactPath}` : null
  ].filter(Boolean).join(" ");
}

function cartQuantityErrorCode(result: CartQuantityResult) {
  if (result.method === "plus-disabled") return "CART_QUANTITY_LIMIT_OR_DISABLED";
  if (result.method === "not-cart-page") return "CART_PAGE_NOT_ACTIVE";
  if (result.method === "cart-item-row-not-found") return "CART_ITEM_ROW_NOT_FOUND";
  if (result.method === "quantity-control-not-found") return "CART_QUANTITY_CONTROL_NOT_FOUND";
  return "CART_QUANTITY_UNCONFIRMED";
}
