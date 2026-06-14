import { withBrowser } from "./browser";

const vendor = process.argv[2];
const urls: Record<string, string> = {
  coupang: "https://www.coupang.com/",
  swadpia: "https://www.swadpia.co.kr/"
};

async function main() {
  if (!vendor || !urls[vendor]) {
    console.error("Usage: npm run purchase-worker:login:coupang OR npm run purchase-worker:login:swadpia");
    process.exit(1);
  }

  await withBrowser(async ({ page }) => {
    await page.goto(urls[vendor], { waitUntil: "domcontentloaded" });
    console.log(`[purchase-worker] ${vendor} login browser opened.`);
    console.log("[purchase-worker] Log in manually, then press Ctrl+C in this terminal when done.");
    await new Promise(() => null);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
