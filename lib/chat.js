import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readKnowledge(name) {
  const here = dirname(fileURLToPath(import.meta.url));
  const paths = [
    join(here, "../knowledge", name),
    join(process.cwd(), "knowledge", name),
  ];

  for (const path of paths) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      // 다음 경로 시도
    }
  }

  throw new Error(`지식 파일을 찾을 수 없습니다: ${name}`);
}

function loadSystemPrompt() {
  const convention = readKnowledge("ASSAC_naming_convention.md");
  const architecture = readKnowledge("ASSAC_architecture.md");
  const finalConvention = readKnowledge("ASSAC_final_naming_convention.md");

  return `당신은 ASSAC 팀의 네이밍 어시스턴트입니다.
역할을 거절하는 봇이 아닙니다. 이름을 지어 주는 것이 일입니다.

프로젝트가 두 개 있습니다.
- 최종 프로젝트(항공기 지연 분석 플랫폼): [최종 프로젝트 네이밍 컨벤션] 문서가 기준입니다. **기본값입니다.**
- 중간 프로젝트(petclinic 3-tier): [중간 프로젝트 네이밍 컨벤션]과 [아키텍처] 문서가 기준입니다. 질문에 petclinic, WAS, CloudFront, WAF, Bastion, 중간 프로젝트가 나올 때만 씁니다.
- 어느 쪽인지 애매하면 최종 프로젝트 기준으로 답하고, 첫 줄에 "최종 프로젝트 기준"이라고 적으세요.
- 두 문서의 규칙을 섞지 마세요. 예: 최종 프로젝트 역할은 \`assac-<리소스>-role\` 또는 \`assac-<용도>-<서비스>-role\`, 중간 프로젝트 역할은 \`assac-role-<용도>\`.

최종 프로젝트 이름 짓는 절차 (반드시 이 순서):
1. 6장 인벤토리에 있는지 찾는다. ✅이면 그 이름을 그대로 답한다. 🔁·🟡이면 지금 이름과 규칙상 이름을 둘 다 알려 준다.
2. 없으면 2장 문법을 고른다. 기본은 종류가 앞(\`assac-<종류>-<대상>[-<세부>][-<AZ/번호>]\`), Lambda만 동사가 앞(\`assac-<동사>-<대상>\`), IAM 역할은 \`-role\`로 끝난다.
3. 3장 단어 사전에 있는 단어만 쓴다. 종류 약어는 3.1, 소스는 \`kac/icn/adsb/weather/airportal\`만, 용도 단어는 3.3. 줄임말(wx, dly)이나 역할 코드(c-, a-), 사람 이름은 쓰지 않는다.
4. 5장 AWS 제약(길이, 허용 문자)을 확인한다. Glue/Athena DB·테이블, RDS 내부, Airflow, dbt는 언더스코어(2.4).
5. S3 경로·테이블·컬럼을 물으면 7장 규칙을 쓴다 (\`<층>/<소스>/<데이터셋>/dt=YYYYMMDD/\`, 컬럼 \`flight_no\`, \`dep_delay_min\` 등).
6. 8장 기준으로 Owner를 고른다.

최종 프로젝트 답변 형식 (항상 이대로, 짧게):
이름: \`assac-...\`
근거: 어떤 규칙(장 번호)으로 만들었는지 한 줄
태그:
- Team: ASSAC
- Owner: ingest-admin
- 같은 종류가 여러 개 필요하면 이름을 모두 백틱으로 나열한다. 함께 필요한 리소스(예: Lambda를 물으면 실행 역할, 스케줄)가 있으면 "함께 만들 것"으로 이름을 같이 준다.
- 사용자가 규칙에 안 맞는 이름을 말하면(예: \`assac-c-glue-role\`, \`assac-wx-...\`) 틀린 이유를 한 줄로 말하고 맞는 이름을 준다(9장).
- Owner는 ingest-admin / stream-admin / batch-admin / platform-admin 중 하나. Project/Environment 태그 금지.

중간 프로젝트 답변 원칙:
- 인벤토리(1장)에 있으면 그 확정 이름을 그대로 쓰세요.
- 인벤토리에 없으면 2장 규칙으로 조합하세요. "인벤토리에 없다"고만 답하지 마세요.
- 예: 부하테스트 Lambda → assac-lambda-load-test. 용도는 영어 소문자+하이픈.
- 혼동 표(3장): DB 서브넷 ≠ SNG, WAS 서브넷 ≠ WAS EC2.
- 이미 확정된 것과 충돌하면(예: NAT를 c에 새로 두기, 서브넷 형식 깨기) 충돌을 말하고 규칙에 맞는 대안을 주세요.
- 태그를 묻지 않아도 모든 답변에 필수 태그 2종을 같이 적으세요. 형식은 반드시 아래처럼:
이름: \`assac-...\`
태그:
- Team: ASSAC
- Owner: network-admin
- Owner는 network-admin / data-security-admin / app-deploy-admin / edge-security-admin / ops-admin 중 하나. Project/Environment 금지.
- Bastion이면 AutoOnOff: true도 태그 아래에 적으세요.
- 이름에 prod/dev를 넣지 마세요. 추천 이름은 백틱. 한국어로 짧게.

---
[최종 프로젝트 네이밍 컨벤션]
${finalConvention}

---
[중간 프로젝트 네이밍 컨벤션]
${convention}

---
[아키텍처]
${architecture}
---`;
}

function normalizeMessages(incoming) {
  return (Array.isArray(incoming) ? incoming : [])
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
}

function normalizeApiKey(value) {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");
}

function requestBody(req) {
  const body = req.body;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body || {};
}

function openRouterError(status, raw) {
  try {
    const parsed = JSON.parse(raw);
    const message =
      parsed.error?.message || parsed.message || parsed.error || raw;
    return `OpenRouter 오류 (${status}): ${String(message).slice(0, 300)}`;
  } catch {
    return `OpenRouter 오류 (${status})`;
  }
}

async function completeOpenRouter({ apiKey, model, messages, stream, referer }) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "ASSAC Naming Bot",
    },
    body: JSON.stringify({
      model,
      stream,
      messages,
    }),
  });
}

async function writeStream(upstream, res) {
  if (!upstream.body) {
    return false;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let wrote = false;

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
        return true;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          wrote = true;
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      } catch {
        // 불완전한 SSE 조각은 무시
      }
    }
  }

  res.write("data: [DONE]\n\n");
  return wrote;
}

export async function handleChat(req, res) {
  const apiKey = normalizeApiKey(process.env.OPENROUTER_API_KEY);
  const model = normalizeApiKey(process.env.OPENROUTER_MODEL) || "openai/gpt-4o-mini";

  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY가 설정되지 않았습니다." });
    return;
  }

  const messages = normalizeMessages(requestBody(req).messages);
  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    res.status(400).json({ error: "사용자 메시지가 필요합니다." });
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const referer = `${proto}://${host}`;
  const payload = [
    { role: "system", content: loadSystemPrompt() },
    ...messages,
  ];

  let upstream = await completeOpenRouter({
    apiKey,
    model,
    messages: payload,
    stream: true,
    referer,
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    res.status(502).json({ error: openRouterError(upstream.status, detail) });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const streamed = await writeStream(upstream, res);
    if (streamed) {
      res.end();
      return;
    }

    const fallback = await completeOpenRouter({
      apiKey,
      model,
      messages: payload,
      stream: false,
      referer,
    });
    if (!fallback.ok) {
      const detail = await fallback.text();
      res.write(`data: ${JSON.stringify({ text: openRouterError(fallback.status, detail) })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const json = await fallback.json();
    const text = json.choices?.[0]?.message?.content || "";
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "응답 스트리밍 중 오류가 발생했습니다.";
    if (!res.headersSent) {
      res.status(500).json({ error: message });
      return;
    }
    res.end();
  }
}
