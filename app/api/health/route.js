import { prisma } from "../../../lib/prisma";

export async function GET() {
  const basePayload = {
    service: "chloris",
    checkedAt: new Date().toISOString()
  };

  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        ...basePayload,
        ok: false,
        database: "missing DATABASE_URL"
      },
      { status: 503 }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("[health] db check failed:", error?.message);
    return Response.json(
      {
        ...basePayload,
        ok: false,
        database: "unavailable",
        error:
          process.env.NODE_ENV === "production"
            ? "Database health check failed"
            : error.message
      },
      { status: 503 }
    );
  }

  return Response.json({
    ...basePayload,
    ok: true,
    database: "ok"
  });
}
