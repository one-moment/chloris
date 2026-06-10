// 모듈 경계 검사: modules/<A>/ 내부 파일이 다른 modules/<B>/를 import하면 실패한다.
// 규칙 근거: docs/platform-architecture.md 12절 (모듈 간 연계는 플랫폼 이벤트 경유).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";

const ROOT = resolve(process.cwd());
const MODULES_DIR = join(ROOT, "modules");
const IMPORT_PATTERN = /(?:import\s[^"']*|from\s*|require\()\s*["']([^"']+)["']/g;

function listFiles(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    if (statSync(fullPath).isDirectory()) entries.push(...listFiles(fullPath));
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) entries.push(fullPath);
  }
  return entries;
}

function moduleSlugOf(filePath) {
  const relative = filePath.slice(MODULES_DIR.length + 1);
  const [first] = relative.split(sep);
  return first.includes(".") ? null : first;
}

let violations = 0;
let moduleDirs = [];
try {
  moduleDirs = readdirSync(MODULES_DIR).filter((name) => {
    try {
      return statSync(join(MODULES_DIR, name)).isDirectory();
    } catch {
      return false;
    }
  });
} catch {
  process.exit(0);
}

for (const slug of moduleDirs) {
  for (const filePath of listFiles(join(MODULES_DIR, slug))) {
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const resolved = resolve(dirname(filePath), specifier);
      if (!resolved.startsWith(MODULES_DIR + sep)) continue;
      const targetSlug = moduleSlugOf(resolved);
      if (targetSlug && targetSlug !== slug) {
        console.error(`module boundary violation: modules/${slug} -> modules/${targetSlug}`);
        console.error(`  at ${filePath.slice(ROOT.length + 1)} (import "${specifier}")`);
        violations += 1;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} module boundary violation(s). Modules must not import other modules; use lib/platform events instead.`);
  process.exit(1);
}
console.log("module boundaries ok");
