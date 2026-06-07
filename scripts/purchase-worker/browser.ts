import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "./config";

export type BrowserSession = {
  context: BrowserContext;
  page: Page;
};

export async function withBrowser<T>(callback: (session: BrowserSession) => Promise<T>) {
  await mkdir(config.userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(config.userDataDir, {
    headless: config.headless,
    viewport: { width: 1365, height: 900 }
  });
  const page = context.pages()[0] ?? await context.newPage();

  try {
    return await callback({ context, page });
  } finally {
    await context.close();
  }
}
