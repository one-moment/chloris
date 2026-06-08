import dotenv from "dotenv";
import { homedir } from "node:os";
import path from "node:path";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

function expandHome(value: string) {
  return value.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
}

export const config = {
  serverUrl: process.env.PURCHASE_BOT_SERVER_URL ?? "http://localhost:3001",
  token: process.env.PURCHASE_BOT_WORKER_TOKEN ?? "local-dev-worker-token",
  headless: process.env.PURCHASE_BOT_BROWSER_HEADLESS === "true",
  browserChannel: process.env.PURCHASE_BOT_BROWSER_CHANNEL || undefined,
  handoffBrowser: process.env.PURCHASE_BOT_HANDOFF_BROWSER ?? "Google Chrome",
  handoffOnly: process.env.PURCHASE_BOT_HANDOFF_ONLY !== "false",
  runOnce: process.env.PURCHASE_BOT_RUN_ONCE === "true",
  pollIntervalMs: Number(process.env.PURCHASE_BOT_POLL_INTERVAL_MS ?? 5000),
  userDataDir: expandHome(process.env.PURCHASE_BOT_USER_DATA_DIR ?? "~/.purchase-bot/browser-profile"),
  screenshotDir: expandHome(process.env.PURCHASE_BOT_SCREENSHOT_DIR ?? "~/.purchase-bot/screenshots"),
  debugDir: expandHome(process.env.PURCHASE_BOT_DEBUG_DIR ?? "~/.purchase-bot/debug")
};
