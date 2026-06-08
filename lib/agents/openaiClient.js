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
