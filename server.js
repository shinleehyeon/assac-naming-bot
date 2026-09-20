import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));
const convention = readFileSync(
  join(__dirname, "knowledge/ASSAC_naming_convention.md"),
  "utf8",
);
const architecture = readFileSync(
  join(__dirname, "knowledge/ASSAC_architecture.md"),
  "utf8",
);

const SYSTEM_PROMPT = `당신은 ASSAC 팀의 네이밍 어시스턴트입니다.
역할을 거절하는 봇이 아닙니다. 이름을 지어 주는 것이 일입니다.

답변 원칙:
- 인벤토리(1장)에 있으면 그 확정 이름을 그대로 쓰세요.
- 인벤토리에 없으면 2장 규칙으로 조합하세요. "인벤토리에 없다"고만 답하지 마세요.
- 예: 부하테스트 Lambda → assac-lambda-load-test. 용도는 영어 소문자+하이픈.
- 혼동 표(3장): DB 서브넷 ≠ SNG, WAS 서브넷 ≠ WAS EC2.
- 이미 확정된 것과 충돌하면(예: NAT를 c에 새로 두기, 서브넷 형식 깨기) 충돌을 말하고 규칙에 맞는 대안을 주세요.
- 태그를 묻지 않아도 모든 답변에 필수 태그 2종을 같이 적으세요. Team=ASSAC, Owner는 인벤토리 역할 또는 용도에 맞는 역할(network-admin / data-security-admin / app-deploy-admin / edge-security-admin / ops-admin). Project/Environment는 넣지 마세요.
- Bastion이면 AutoOnOff=true도 적으세요. 그 외 선택 태그는 필요할 때만.
- 이름에 prod/dev를 넣지 마세요. 추천 이름은 백틱. 한국어로 짧게.

---
[네이밍 컨벤션]
${convention}

---
[아키텍처]
${architecture}
---`;

const app = express();
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

app.use(express.json({ limit: "32kb" }));
app.use(express.static(join(__dirname, "dist")));

app.post("/api/chat", async (req, res) => {
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY가 설정되지 않았습니다." });
    return;
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = incoming
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }));

  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    res.status(400).json({ error: "사용자 메시지가 필요합니다." });
    return;
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "ASSAC Naming Bot",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    res.status(502).json({ error: "OpenRouter 호출에 실패했습니다.", detail });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch {
          // 불완전한 SSE 조각은 무시
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: "응답 스트리밍 중 오류가 발생했습니다." });
      return;
    }
    res.end();
  }
});

if (existsSync(join(__dirname, "dist/index.html"))) {
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(join(__dirname, "dist/index.html"));
  });
}

app.listen(port, () => {
  console.log(`ASSAC Naming Bot API: http://localhost:${port}`);
});
