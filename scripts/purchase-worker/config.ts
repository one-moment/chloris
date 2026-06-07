import "dotenv/config";
import { homedir } from "node:os";
import path from "node:path";

function expandHome(value: string) {
  return value.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
}

export const config = {
  serverUrl: process.env.PURCHASE_BOT_SERVER_URL ?? "http://localhost:3001",
  token: process.env.PURCHASE_BOT_WORKER_TOKEN ?? "local-dev-worker-token",
  headless: process.env.PURCHASE_BOT_BROWSER_HEADLESS === "true",
  pollIntervalMs: Number(process.env.PURCHASE_BOT_POLL_INTERVAL_MS ?? 5000),
  userDataDir: expandHome(process.env.PURCHASE_BOT_USER_DATA_DIR ?? "~/.purchase-bot/browser-profile"),
  screenshotDir: expandHome(process.env.PURCHASE_BOT_SCREENSHOT_DIR ?? "~/.purchase-bot/screenshots")
};
