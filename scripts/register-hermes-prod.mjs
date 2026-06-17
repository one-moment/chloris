// 헤르메스 운영 등록 스크립트 — 대상 DB에 hermes-agent를 등록(+선택적 채널 설치).
// 기본 dry-run(쓰기 없음). 실제 쓰기는 --commit --yes 가 둘 다 있어야 한다.
//
// ⚠️ 운영 실행 전 준비
//   1) 포스트그레스 prisma 클라이언트 생성(운영은 postgres):
//        npx prisma generate --schema prisma/schema.postgres.prisma
//   2) 대상(운영) DATABASE_URL은 .env.ops(gitignore) 파일에 넣거나 인라인으로 지정한다.
//      ⚠️ 로컬 dev/test용 .env(file:./dev.db)는 읽지 않는다 — 운영 오타깃 방지.
//
// 사용법
//   # (1) dry-run: 대상 DB(가림)·채널 목록·현재 등록상태만 출력, 쓰기 없음
//   DATABASE_URL="postgres://...운영..." DIRECT_URL="postgres://...운영-direct..." npx tsx scripts/register-hermes-prod.mjs
//
//   # (2) AgentApp만 등록(설치는 관리자 UI로 따로)
//   DATABASE_URL="postgres://...운영..." npx tsx scripts/register-hermes-prod.mjs --commit --yes
//
//   # (3) AgentApp 등록 + 특정 지점방 채널에 설치 (권장: 먼저 시범 1개 채널)
//   DATABASE_URL="postgres://...운영..." npx tsx scripts/register-hermes-prod.mjs --commit --yes --channel <channelId>
//
// 설치 대안: 배포된 앱에서 관리자가 POST /api/channels/<channelId>/agents/hermes-agent/enable (또는 에이전트 설정 UI).
// 이 스크립트는 DELETE/마이그레이션/메일/결제 없음. AgentApp·설치 레코드 upsert(멱등)만 한다.

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const commit = has("--commit");
const yes = has("--yes");
const allowSqlite = has("--allow-sqlite");
const channelId = valueOf("--channel");

function redactDbUrl(url) {
  if (!url) return "(unset)";
  if (url.startsWith("file:")) return `SQLite(file): ${url}`;
  try {
    const u = new URL(url);
    return `${u.protocol.replace(":", "")}://${u.username ? "***@" : ""}${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`;
  } catch {
    return `${url.split("://")[0]}://(parse fail)`;
  }
}

// 대상 DB: (1) 인라인 DATABASE_URL 우선, 없으면 (2) .env.ops(gitignore됨)에서 읽는다.
// 로컬 dev/test용 .env는 의도적으로 읽지 않는다 — 운영 오타깃 방지.
if (!process.env.DATABASE_URL) {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.ops" });
  } catch {}
}

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("✗ DATABASE_URL이 없습니다. 다음 중 하나로 대상(운영) DB를 지정하세요:");
  console.error('  • .env.ops 파일에:  DATABASE_URL="postgresql://…운영…"');
  console.error('  • 또는 인라인으로:  DATABASE_URL="postgresql://…운영…" npx tsx scripts/register-hermes-prod.mjs');
  process.exit(1);
}
console.log("대상 DB:", redactDbUrl(DB));
const isSqlite = DB.startsWith("file:");

const HERMES_AGENT = {
  id: "agentapp-hermes-agent",
  slug: "hermes-agent",
  name: "헤르메스",
  role: "concierge",
  status: "active",
  description: "발주·예약·입고·폐기를 채팅으로 안내·라우팅하는 업무지원 비서(3단계: 예약 양식 미리채움).",
  configJson: JSON.stringify({ mentions: ["@헤르메스", "@hermes", "@Hermes"] })
};

async function main() {
  const { prisma } = await import("../lib/prisma.js");
  try {
    const channels = await prisma.channel.findMany({
      select: { id: true, name: true, type: true, branchId: true },
      orderBy: { createdAt: "asc" }
    });
    const branches = await prisma.branch.findMany({ select: { id: true, name: true } }).catch(() => []);
    const branchName = Object.fromEntries(branches.map((b) => [b.id, b.name]));
    console.log(`\n채널 ${channels.length}개 (설치 대상 id 확인용):`);
    for (const c of channels) {
      console.log(`  - ${c.id}  [${c.type}] ${c.name}${c.branchId ? `  (지점: ${branchName[c.branchId] ?? c.branchId})` : ""}`);
    }

    const existing = await prisma.agentApp.findUnique({ where: { slug: "hermes-agent" } }).catch(() => null);
    console.log(`\nhermes-agent AgentApp: ${existing ? `이미 있음(status=${existing.status})` : "없음 → 생성 예정"}`);

    if (!commit) {
      console.log("\n[dry-run] 쓰기 없음. 실제 등록: --commit --yes (설치까지: --channel <id>) 추가.");
      return;
    }
    if (!yes) {
      console.error("\n✗ --commit에는 --yes도 함께 필요합니다(운영 쓰기 확인).");
      process.exit(1);
    }
    if (isSqlite && !allowSqlite) {
      console.error("\n✗ 대상이 SQLite(file:)입니다 — 운영은 보통 postgres입니다. 의도적으로 로컬에 쓰려면 --allow-sqlite 추가.");
      process.exit(1);
    }

    await prisma.agentApp.upsert({
      where: { slug: "hermes-agent" },
      create: HERMES_AGENT,
      update: { status: "active" }
    });
    console.log("✓ hermes-agent AgentApp upsert(active) 완료.");

    if (channelId) {
      const ch = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, name: true } });
      if (!ch) {
        console.error(`✗ 채널 없음: ${channelId} (위 목록에서 정확한 id 확인).`);
        process.exit(1);
      }
      await prisma.channelAgentInstallation.upsert({
        where: { agentAppId_channelId: { agentAppId: HERMES_AGENT.id, channelId } },
        create: {
          id: `chanagent-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          agentAppId: HERMES_AGENT.id,
          channelId,
          enabled: true,
          enabledAt: new Date(),
          configJson: "{}",
          installedById: null
        },
        update: { enabled: true, enabledAt: new Date(), disabledAt: null }
      });
      console.log(`✓ 채널 설치 완료: ${ch.name} (${channelId}). 이제 이 채널에서 @헤르메스가 동작합니다.`);
    } else {
      console.log("ℹ️ 채널 미지정 — AgentApp만 등록. 설치는 --channel <id> 또는 관리자 UI(POST /api/channels/<id>/agents/hermes-agent/enable).");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
