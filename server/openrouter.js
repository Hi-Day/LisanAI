const { OPENROUTER_URL } = require("./config");

async function callOpenRouter(messages, schemaHint) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY belum diset di .env");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://127.0.0.1:4173",
      "X-Title": "OralAI Assessment",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL,
      temperature: 0.25,
      max_tokens: 4000,
      reasoning: {
        effort: "none",
        exclude: true,
      },
      messages: [
        {
          role: "system",
          content:
            "Anda adalah evaluator pendidikan berbahasa Indonesia. Balas hanya JSON valid tanpa markdown. " +
            schemaHint,
        },
        ...messages,
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter error ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons model kosong");
  return parseJsonContent(content);
}

function parseJsonContent(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Respons model bukan JSON valid");
  }
}

module.exports = {
  callOpenRouter,
};
