import { completeBotRun } from "./automation";
import { serializeUser } from "./auth";
import { createInitialState, makeChannel, makeMessage, makePost } from "./initialData";
import { prisma } from "./prisma";
import { formatRelativeDateTime } from "./time";

function clone(value) {
  return structuredClone(value);
}

function nowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function displayTime(value = new Date()) {
  return formatRelativeDateTime(value);
}

function isoTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAttachments(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeBot(bot) {
  return {
    id: bot.id,
    name: bot.name,
    provider: bot.provider,
    command: bot.command,
    channelTypes: bot.channelTypes.split(",").filter(Boolean)
  };
}

function serializeRun(run) {
  return {
    id: run.id,
    botId: run.botId,
    botName: run.botName,
    status: run.status,
    createdAt: displayTime(run.createdAt),
    summary: run.summary,
    payload: JSON.parse(run.payloadJson),
    approvalStatus: run.approvalStatus
  };
}

function serializeComment(comment) {
  return {
    id: comment.id,
    authorId: comment.authorId,
    parentId: comment.parentId ?? null,
    author: comment.author,
    body: comment.body,
    mentions: parseAttachments(comment.mentionsJson),
    createdAt: displayTime(comment.createdAt),
    createdAtIso: isoTime(comment.createdAt),
    updatedAt: displayTime(comment.updatedAt),
    updatedAtIso: isoTime(comment.updatedAt),
    editedAt: comment.editedAt ? displayTime(comment.editedAt) : null,
    editedAtIso: isoTime(comment.editedAt),
    isEdited: Boolean(comment.editedAt)
  };
}

export function serializePost(post) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    attachments: parseAttachments(post.attachmentsJson),
    authorId: post.authorId,
    author: post.author,
    status: post.status,
    createdAt: displayTime(post.createdAt),
    createdAtIso: isoTime(post.createdAt),
    updatedAt: displayTime(post.updatedAt),
    updatedAtIso: isoTime(post.updatedAt),
    editedAt: post.editedAt ? displayTime(post.editedAt) : null,
    editedAtIso: isoTime(post.editedAt),
    isEdited: Boolean(post.editedAt),
    pinned: Boolean(post.pinnedAt),
    pinnedAtIso: isoTime(post.pinnedAt),
    comments: post.comments.map(serializeComment)
  };
}

export function serializeMessage(message) {
  return {
    id: message.id,
    authorId: message.authorId,
    author: message.author,
    body: message.body,
    attachments: parseAttachments(message.attachmentsJson),
    createdAt: displayTime(message.createdAt),
    createdAtIso: isoTime(message.createdAt),
    updatedAt: displayTime(message.updatedAt),
    updatedAtIso: isoTime(message.updatedAt),
    editedAt: message.editedAt ? displayTime(message.editedAt) : null,
    editedAtIso: isoTime(message.editedAt),
    isEdited: Boolean(message.editedAt),
    bot: message.bot
  };
}

function serializePurchaseRequest(request) {
  return {
    id: request.id,
    channelId: request.channelId,
    messageId: request.messageId,
    itemName: request.itemName,
    vendor: request.vendor,
    quantity: request.quantity,
    unitLabel: request.unitLabel,
    status: request.status,
    workerTaskId: request.workerTaskId,
    resultMessage: request.resultMessage,
    createdAt: displayTime(request.createdAt),
    createdAtIso: isoTime(request.createdAt),
    updatedAt: displayTime(request.updatedAt),
    updatedAtIso: isoTime(request.updatedAt)
  };
}

function serializePurchaseOrderDraftLine(line) {
  return {
    id: line.id,
    draftId: line.draftId,
    lineIndex: line.lineIndex,
    vendor: line.vendor,
    itemName: line.itemName,
    quantity: line.quantity,
    unitLabel: line.unitLabel,
    url: line.url,
    notes: line.notes,
    rawText: line.rawText,
    status: line.status,
    createdAt: displayTime(line.createdAt),
    createdAtIso: isoTime(line.createdAt),
    updatedAt: displayTime(line.updatedAt),
    updatedAtIso: isoTime(line.updatedAt)
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializePurchaseOrderVendorTask(task) {
  return {
    id: task.id,
    draftId: task.draftId,
    vendor: task.vendor,
    status: task.status,
    automationLevel: task.automationLevel,
    lineIds: parseJsonArray(task.lineIdsJson),
    purchaseRequestIds: parseJsonArray(task.purchaseRequestIdsJson),
    resultMessage: task.resultMessage,
    createdAt: displayTime(task.createdAt),
    createdAtIso: isoTime(task.createdAt),
    updatedAt: displayTime(task.updatedAt),
    updatedAtIso: isoTime(task.updatedAt)
  };
}

export function serializePurchaseOrderDraft(draft) {
  return {
    id: draft.id,
    requesterId: draft.requesterId,
    channelId: draft.channelId,
    messageId: draft.messageId,
    requesterName: draft.requesterName,
    requesterTeam: draft.requesterTeam,
    status: draft.status,
    sourceText: draft.sourceText,
    createdAt: displayTime(draft.createdAt),
    createdAtIso: isoTime(draft.createdAt),
    updatedAt: displayTime(draft.updatedAt),
    updatedAtIso: isoTime(draft.updatedAt),
    lines: (draft.lines ?? []).map(serializePurchaseOrderDraftLine),
    vendorTasks: (draft.vendorTasks ?? []).map(serializePurchaseOrderVendorTask)
  };
}

export function serializeFile(file) {
  return {
    id: file.id,
    name: file.name,
    source: file.source,
    createdAt: displayTime(file.createdAt)
  };
}

export function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    branchId: channel.branchId ?? null,
    messages: channel.messages.map(serializeMessage),
    posts: channel.posts.map(serializePost),
    files: channel.files.map(serializeFile),
    botRuns: channel.botRuns.map(serializeRun)
  };
}

export function serializeProject(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    channels: project.channels.map(serializeChannel)
  };
}

async function ensureSeedState() {
  const projectCount = await prisma.project.count();
  if (projectCount > 0) return;
  await writeState(createInitialState());
}

function isMissingPurchaseOrderDraftTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("PurchaseOrderDraft");
}

async function readPurchaseOrderDrafts() {
  try {
    return await prisma.purchaseOrderDraft.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        lines: { orderBy: { lineIndex: "asc" } },
        vendorTasks: { orderBy: { createdAt: "asc" } }
      }
    });
  } catch (error) {
    if (isMissingPurchaseOrderDraftTableError(error)) return [];
    throw error;
  }
}

function isMissingReadStateTableError(error) {
  return error?.code === "P2021" || String(error?.message ?? "").includes("ChannelReadState");
}

async function readBranches() {
  try {
    const rows = await prisma.branch.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" }
    });
    return rows.map((branch) => ({
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      status: branch.status
    }));
  } catch (error) {
    if (error?.code === "P2021" || String(error?.message ?? "").includes("Branch")) return [];
    throw error;
  }
}

async function readChannelReadStates(userId) {
  if (!userId) return {};
  try {
    const rows = await prisma.channelReadState.findMany({ where: { userId } });
    return Object.fromEntries(rows.map((row) => [row.channelId, isoTime(row.lastReadAt)]));
  } catch (error) {
    if (isMissingReadStateTableError(error)) return {};
    throw error;
  }
}

export async function readState(currentUserId) {
  await ensureSeedState();
  const [projects, bots, users, purchaseRequests, purchaseOrderDrafts, readStates, branches] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        channels: {
          orderBy: { createdAt: "asc" },
          include: {
            messages: { orderBy: { createdAt: "desc" }, take: 50 },
            posts: {
              orderBy: { createdAt: "desc" },
              take: 50,
              include: { comments: { orderBy: { createdAt: "asc" }, take: 50 } }
            },
            files: { orderBy: { createdAt: "desc" }, take: 50 },
            botRuns: { orderBy: { createdAt: "desc" } }
          }
        }
      }
    }),
    prisma.bot.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.purchaseRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    readPurchaseOrderDrafts(),
    readChannelReadStates(currentUserId),
    readBranches()
  ]);

  const serializedProjects = projects.map(serializeProject);
  const firstProject = serializedProjects[0];
  const firstChannel = firstProject?.channels[0];
  return {
    selectedProjectId: firstProject?.id,
    selectedChannelId: firstChannel?.id,
    projects: serializedProjects,
    bots: bots.map(serializeBot),
    users: users.map(serializeUser),
    purchaseRequests: purchaseRequests.map(serializePurchaseRequest),
    purchaseOrderDrafts: purchaseOrderDrafts.map(serializePurchaseOrderDraft),
    readStates,
    branches
  };
}

export async function writeState(state) {
  await prisma.$transaction(async (tx) => {
    await tx.botRun.deleteMany();
    await tx.file.deleteMany();
    await tx.comment.deleteMany();
    await tx.post.deleteMany();
    await tx.message.deleteMany();
    await tx.channel.deleteMany();
    await tx.project.deleteMany();
    await tx.bot.deleteMany();

    for (const bot of state.bots ?? []) {
      await tx.bot.create({
        data: {
          id: bot.id,
          name: bot.name,
          provider: bot.provider,
          command: bot.command,
          channelTypes: (bot.channelTypes ?? []).join(",")
        }
      });
    }

    for (const project of state.projects ?? []) {
      await tx.project.create({
        data: {
          id: project.id,
          name: project.name,
          description: project.description ?? "",
          channels: {
            create: (project.channels ?? []).map((channel) => ({
              id: channel.id,
              name: channel.name,
              type: channel.type,
              messages: {
                create: (channel.messages ?? []).map((message) => ({
                  id: message.id,
                  authorId: message.authorId,
                  author: message.author,
                  body: message.body,
                  attachmentsJson: JSON.stringify(message.attachments ?? []),
                  bot: Boolean(message.bot)
                }))
              },
              posts: {
                create: (channel.posts ?? []).map((post) => ({
                  id: post.id,
                  authorId: post.authorId,
                  title: post.title,
                  body: post.body,
                  attachmentsJson: JSON.stringify(post.attachments ?? []),
                  author: post.author,
                  status: post.status,
                  comments: {
                    create: (post.comments ?? []).map((comment) => ({
                      id: comment.id,
                      authorId: comment.authorId,
                      author: comment.author,
                      body: comment.body
                    }))
                  }
                }))
              },
              files: {
                create: (channel.files ?? []).map((file) => ({
                  id: file.id,
                  name: file.name,
                  source: file.source
                }))
              },
              botRuns: {
                create: (channel.botRuns ?? []).map((run) => ({
                  id: run.id,
                  botId: run.botId,
                  botName: run.botName,
                  status: run.status,
                  approvalStatus: run.approvalStatus,
                  summary: run.summary,
                  payloadJson: JSON.stringify(run.payload)
                }))
              }
            }))
          }
        }
      });
    }
  }, { maxWait: 10000, timeout: 20000 });

  return state;
}

export async function updateState(mutator) {
  const state = await readState();
  const nextState = clone(state);
  const result = mutator(nextState);
  await writeState(nextState);
  return result ?? nextState;
}

export function findProject(state, projectId) {
  return state.projects.find((project) => project.id === projectId);
}

export function findChannelContext(state, channelId) {
  for (const project of state.projects) {
    const channel = project.channels.find((item) => item.id === channelId);
    if (channel) return { project, channel };
  }
  return null;
}

export function findPostContext(state, postId) {
  for (const project of state.projects) {
    for (const channel of project.channels) {
      const post = channel.posts.find((item) => item.id === postId);
      if (post) return { project, channel, post };
    }
  }
  return null;
}

export function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(message) {
  return Response.json({ error: message }, { status: 404 });
}

export function createProjectRecord(name) {
  const firstChannel = makeChannel("매니저 소통", "general");
  return {
    project: {
      id: nowId("project"),
      name,
      description: `${name} 내부 커뮤니케이션 공간`,
      channels: [firstChannel]
    },
    firstChannel
  };
}

export function createChannelRecord({ name, type = "general" }) {
  return makeChannel(name, type);
}

export function createMessageRecord({ body, author = "captain", authorId, bot = false, attachments = [] }) {
  return {
    ...makeMessage(body, author, bot),
    authorId,
    attachments
  };
}

export function createPostRecord({ title, body, author = "captain", authorId, status = "검토중", attachments = [] }) {
  return {
    ...makePost({ title, body, author, status }),
    authorId,
    attachments
  };
}

export function createCommentRecord({ body, author = "captain", authorId }) {
  return {
    id: nowId("comment"),
    authorId,
    author,
    body,
    createdAt: displayTime()
  };
}

export function createFileRecord({ name, source = "수동 추가" }) {
  return {
    id: nowId("file"),
    name,
    source,
    createdAt: displayTime()
  };
}

export function updateBotRunForAction(run, channelType, action) {
  if (action === "complete") return completeBotRun(run, channelType);
  if (action === "approve") {
    return {
      ...run,
      status: "승인 완료",
      approvalStatus: "승인 완료",
      summary: "담당자가 결제를 승인했습니다. 구매봇이 최종 결제 단계로 진행할 수 있습니다."
    };
  }
  if (action === "reject") {
    return {
      ...run,
      status: "반려",
      approvalStatus: "반려",
      summary: "담당자가 자동 구매 실행을 반려했습니다."
    };
  }
  return run;
}
