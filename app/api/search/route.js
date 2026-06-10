import { requireCurrentUser } from "../../../lib/auth";
import { badRequest } from "../../../lib/serverState";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

const RESULT_LIMIT = 20;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function snippet(text, query) {
  const body = String(text ?? "");
  if (!query) return body.slice(0, 120);
  const index = body.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return body.slice(0, 120);
  const start = Math.max(0, index - 30);
  return `${start > 0 ? "…" : ""}${body.slice(start, start + 120)}`;
}

export async function GET(request) {
  const user = await requireCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const author = searchParams.get("author")?.trim() ?? "";
  const from = parseDate(searchParams.get("from"));
  const toRaw = parseDate(searchParams.get("to"));
  const to = toRaw ? endOfDay(toRaw) : null;

  if (!q && !author && !from && !to) {
    return badRequest("At least one search filter is required.");
  }

  const createdAt = {};
  if (from) createdAt.gte = from;
  if (to) createdAt.lt = to;

  const commonFilters = [];
  if (Object.keys(createdAt).length > 0) commonFilters.push({ createdAt });
  if (author) commonFilters.push({ author: { contains: author } });

  const postWhere = {
    AND: [
      ...commonFilters,
      ...(q ? [{
        OR: [
          { title: { contains: q } },
          { body: { contains: q } },
          { comments: { some: { body: { contains: q } } } }
        ]
      }] : [])
    ]
  };

  const messageWhere = {
    AND: [
      ...commonFilters,
      ...(q ? [{ body: { contains: q } }] : [])
    ]
  };

  const channelSelect = { select: { id: true, name: true, projectId: true } };
  const [posts, messages] = await Promise.all([
    prisma.post.findMany({
      where: postWhere,
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT,
      include: { channel: channelSelect }
    }),
    prisma.message.findMany({
      where: messageWhere,
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT,
      include: { channel: channelSelect }
    })
  ]);

  return Response.json({
    posts: posts.map((post) => ({
      id: post.id,
      type: "post",
      channelId: post.channelId,
      channelName: post.channel?.name ?? "",
      projectId: post.channel?.projectId ?? null,
      title: post.title,
      snippet: snippet(post.body || post.title, q),
      author: post.author,
      createdAtIso: post.createdAt.toISOString()
    })),
    messages: messages.map((message) => ({
      id: message.id,
      type: "message",
      channelId: message.channelId,
      channelName: message.channel?.name ?? "",
      projectId: message.channel?.projectId ?? null,
      title: null,
      snippet: snippet(message.body, q),
      author: message.author,
      createdAtIso: message.createdAt.toISOString()
    }))
  });
}
