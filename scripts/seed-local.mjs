// Local-only seed for the SQLite test DB. Safe: never run against production.
// Seeds the 3 branches + a couple of shared post templates so the template
// feature can be tested end-to-end right after registering the first account.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const branches = [
  { id: "branch-gangnam-1", name: "강남1호점", slug: "gangnam-1" },
  { id: "branch-gangnam-2", name: "강남2호점", slug: "gangnam-2" },
  { id: "branch-jamsil", name: "잠실점", slug: "jamsil" }
];

const templates = [
  {
    id: "tmpl-seed-purchase",
    name: "구매요청",
    scope: "shared",
    body: "[구매요청 / {{지점}}]\n• 품목 :\n• 수량 :\n• 거래처/링크 :\n• 요청자 : {{작성자}}\n• 요청일 : {{오늘}}"
  },
  {
    id: "tmpl-seed-handover",
    name: "인계사항",
    scope: "shared",
    body: "[인계사항 / {{지점}}]\n• 일자 : {{오늘}}\n• 작성자 : {{작성자}}\n• 전달 내용 :\n• 확인 필요 :"
  }
];

for (const branch of branches) {
  await prisma.branch.upsert({
    where: { id: branch.id },
    update: {},
    create: { ...branch, status: "active" }
  });
}

for (const template of templates) {
  await prisma.postTemplate.upsert({
    where: { id: template.id },
    update: {},
    create: { ...template, ownerId: null, createdById: null }
  });
}

console.log(`seeded ${branches.length} branches + ${templates.length} shared templates`);
await prisma.$disconnect();
