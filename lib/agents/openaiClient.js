export async function classifyAgentIntent({ messages, schema, model = process.env.OPENAI_AGENT_MODEL ?? "gpt-4.1-mini" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "OPENAI_API_KEY is not configured." };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: messages,
      text: schema ? { format: schema } : undefined
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI intent classification failed (${response.status}): ${text.slice(0, 500)}`);
  }

  return response.json();
}

function pickResponsesOutputText(payload) {
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

const STATEMENT_OCR_INSTRUCTION = [
  "다음 거래명세서(꽃 도매) 사진에서 품목 라인을 정확히 추출하세요.",
  "설명 없이 JSON만 출력합니다. 형식:",
  '{ "supplier": string|null, "statementDate": "YYYY-MM-DD"|null, "lines": [ { "itemName": string, "quantity": number, "unitPrice": number, "amount": number|null, "note": string|null } ] }',
  "- itemName은 표의 품명 그대로(괄호·색상·원산지 포함).",
  "- quantity는 단수(수량), unitPrice는 단가(원), amount는 금액(원).",
  "- 합계/총금액/머리글 행은 제외하고 품목 행만 포함.",
  "- 읽을 수 없는 값은 0 또는 null."
].join("\n");

// 거래명세서 사진 → 품목 라인 추출(Vision). 키가 없거나 실패하면 skipped/parseError로 degrade한다.
export async function extractStatementLineItems({ imageUrl, model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_AGENT_MODEL ?? "gpt-4.1-mini" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { skipped: true, reason: "OPENAI_API_KEY is not configured." };
  if (!imageUrl) return { skipped: true, reason: "imageUrl is required." };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: STATEMENT_OCR_INSTRUCTION },
            { type: "input_image", image_url: imageUrl }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI statement OCR failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const outputText = pickResponsesOutputText(payload);
  try {
    const jsonText = outputText.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return { skipped: false, result: JSON.parse(jsonText) };
  } catch {
    return { skipped: false, parseError: true, raw: outputText.slice(0, 2000) };
  }
}
