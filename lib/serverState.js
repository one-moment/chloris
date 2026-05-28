import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { completeBotRun } from "./automation";
import { createInitialState, makeChannel, makeMessage, makePost } from "./initialData";

const DATA_PATH = join(process.cwd(), ".data", "app-state.json");

function clone(value) {
  return structuredClone(value);
}

async function ensureDataFile() {
  await mkdir(dirname(DATA_PATH), { recursive: true });
}

export async function readState() {
  try {
    const content = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(content);
    if (parsed?.projects?.[0]?.channels && parsed?.bots) return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to read app state", error);
    }
  }

  const initialState = createInitialState();
  await writeState(initialState);
  return initialState;
}

export async function writeState(state) {
  await ensureDataFile();
  await writeFile(DATA_PATH, JSON.stringify(state, null, 2), "utf8");
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
      id: `project-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

export function createMessageRecord({ body, author = "captain", bot = false }) {
  return makeMessage(body, author, bot);
}

export function createPostRecord({ title, body, author = "captain", status = "검토중" }) {
  return makePost({ title, body, author, status });
}

export function createCommentRecord({ body, author = "captain" }) {
  return {
    id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author,
    body,
    createdAt: "방금 전"
  };
}

export function createFileRecord({ name, source = "수동 추가" }) {
  return {
    id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    source,
    createdAt: "방금 전"
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
