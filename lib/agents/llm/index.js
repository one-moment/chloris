import { classifyAgentIntent } from "../openaiClient";

// OpenAI Responses 출력에서 텍스트를 뽑는다(openaiClient의 pickResponsesOutputText는 export 안 됨 → 여기 작게 재구현).
function pickOutputText(payload) {
  if (!payload) return "";
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const chunk of content) {
      if (typeof chunk?.text === "string") parts.push(chunk.text);
    }
  }
  return parts.join("\n");
}

function parseJsonLoose(text) {
  const cleaned = String(text ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// 공급사 교체 가능한 얇은 스위치. 시작 공급사 OpenAI. 다른 어댑터는 자리만(미구현).
// 반환: { skipped:true,... } | { ok:true, data } | { error:"parse" }.  (HTTP 오류 throw는 호출자가 잡음)
export async function classifyJson({ messages }) {
  const provider = process.env.AGENT_LLM_PROVIDER || "openai";

  if (provider === "openai") {
    const payload = await classifyAgentIntent({ messages });
    if (payload?.skipped) return payload;
    try {
      return { ok: true, data: parseJsonLoose(pickOutputText(payload)) };
    } catch {
      return { error: "parse" };
    }
  }

  return { skipped: true, reason: "unknown_provider" };
}
