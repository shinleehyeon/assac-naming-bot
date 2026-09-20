import { useEffect, useRef, useState } from "react"
import { Bot, Check, Copy, Moon, Send, Sun, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useTheme } from "@/components/theme-provider"

type ChatRole = "user" | "assistant"
type ChatMessage = {
  role: ChatRole
  content: string
}

const WELCOME =
  "어떤 리소스 이름을 지을까요? 예: WAS용 Security Group, petclinic RDS, 알림용 Lambda."

const SUGGESTIONS = [
  {
    label: "SG / WAS",
    prompt: "WAS용 Security Group 이름 지어줘",
  },
  {
    label: "RDS",
    prompt: "petclinic RDS 인스턴스 이름과 필수 태그 알려줘",
  },
  {
    label: "Subnet",
    prompt: "WAS 서브넷이랑 DB 서브넷 이름 지어줘",
  },
  {
    label: "Lambda",
    prompt: "WAF 알림용 Lambda 이름 추천해줘",
  },
  {
    label: "아키텍처",
    prompt: "우리 아키텍처에서 내부 ALB랑 WAS는 어디에 있어? 이름도 알려줘",
  },
] as const

function formatMessage(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8rem]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

const TAG_KEYS = ["Team", "Owner", "AutoOnOff", "ManagedBy"] as const

function parseAssistantReply(text: string) {
  const names = [
    ...text.matchAll(/`([^`]+)`/g),
    ...text.matchAll(
      /(?<!`)\b(assac(?:\/[a-z0-9-]+)+|assac-[a-z0-9-]+(?:\/[a-z0-9-]+)*|\/assac\/[a-z0-9-]+)\b/g,
    ),
  ]
    .map((match) => match[1])
    .filter((name, index, all) => name && all.indexOf(name) === index)

  const tags = [...text.matchAll(
    new RegExp(
      `(?:^|\\n)\\s*-?\\s*(${TAG_KEYS.join("|")})\\s*[:=]\\s*([^\\s,]+)`,
      "gi",
    ),
  )].map((match) => ({
    key: match[1],
    value: match[2].replace(/[`]/g, ""),
  }))

  const note = text
    .replace(/`[^`]+`/g, "")
    .replace(
      new RegExp(
        `(?:^|\\n)\\s*-?\\s*(?:${TAG_KEYS.join("|")})\\s*[:=]\\s*[^\\s,]+`,
        "gi",
      ),
      "",
    )
    .replace(/^(이름|태그)\s*[:：]\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return { names, tags, note }
}

function CopyName({ name }: { name: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 font-mono text-[0.8rem] break-all">
        {name}
      </code>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => {
          void navigator.clipboard.writeText(name).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          })
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "복사됨" : "복사"}
      </Button>
    </div>
  )
}

function AssistantBody({ text }: { text: string }) {
  if (!text) {
    return <p>생각 중...</p>
  }

  if (text.startsWith("오류:") || text === WELCOME) {
    return <div className="whitespace-pre-wrap">{formatMessage(text)}</div>
  }

  const { names, tags, note } = parseAssistantReply(text)

  if (names.length === 0 && tags.length === 0) {
    return <div className="whitespace-pre-wrap">{formatMessage(text)}</div>
  }

  return (
    <div className="space-y-3">
      {names.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">이름</p>
          {names.map((name) => (
            <CopyName key={name} name={name} />
          ))}
        </div>
      ) : null}
      {tags.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">태그</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={`${tag.key}-${tag.value}`} variant="secondary">
                {tag.key}: {tag.value}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {note ? (
        <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
          {note}
        </p>
      ) : null}
    </div>
  )
}

async function readChatStream(
  response: Response,
  onText: (text: string) => void,
) {
  if (!response.body) {
    throw new Error("스트리밍 응답이 없습니다.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let reply = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""

    for (const chunk of chunks) {
      const line = chunk.trim()
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") {
        return reply
      }

      const parsed = JSON.parse(data) as { text?: string }
      reply += parsed.text ?? ""
      onText(reply)
    }
  }

  return reply
}

export function App() {
  const { theme, setTheme } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLight = theme === "light"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  async function send(text: string) {
    const content = text.trim()
    if (!content || pending) return

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ]

    setInput("")
    setPending(true)
    setMessages([...nextMessages, { role: "assistant", content: "" }])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          detail?: string
        }
        throw new Error(
          payload.error || payload.detail || "요청에 실패했습니다.",
        )
      }

      const reply = await readChatStream(response, (textSoFar) => {
        setMessages([...nextMessages, { role: "assistant", content: textSoFar }])
      })

      if (!reply) {
        throw new Error("모델 응답이 비어 있습니다.")
      }

      setMessages([...nextMessages, { role: "assistant", content: reply }])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청에 실패했습니다."
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `오류: ${message}` },
      ])
    } finally {
      setPending(false)
    }
  }

  const thread: ChatMessage[] =
    messages.length === 0
      ? [{ role: "assistant", content: WELCOME }]
      : messages

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto grid min-h-svh max-w-6xl lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-border p-6 lg:border-r lg:border-b-0">
          <Badge variant="secondary">ASSAC</Badge>
          <h1 className="mt-3 font-heading text-3xl tracking-tight">
            Naming Bot
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            있는 리소스는 확정 이름, 없는 리소스는 컨벤션으로 조합해
            제안합니다.
          </p>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>표에 없을 때만</CardTitle>
              <CardDescription>
                리소스별 표가 우선입니다. 없는 항목만 이 패턴을 씁니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <code className="font-mono text-xs break-all">
                assac-&lt;계층&gt;-&lt;용도&gt;-&lt;번호&gt;
              </code>
            </CardContent>
          </Card>

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>리소스 종류, 용도, 또는 아키텍처 위치를 알려주세요</li>
            <li>이름에 prod는 넣지 않습니다. Owner는 역할명</li>
            <li>물어볼 필요 없이 이름과 태그(Team, Owner)를 함께 제안합니다</li>
          </ul>
        </aside>

        <main className="flex min-h-[70svh] flex-col lg:h-svh">
          <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <p className="font-medium">네이밍 도우미</p>
              <p className="text-sm text-muted-foreground">
                OpenRouter로 컨벤션에 맞는 이름을 제안합니다
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="테마 전환"
                onClick={() => setTheme(isLight ? "dark" : "light")}
              >
                {isLight ? <Moon /> : <Sun />}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMessages([])
                  setInput("")
                }}
              >
                새 대화
              </Button>
            </div>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 px-6 py-6">
              {thread.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "flex justify-end gap-3"
                      : "flex gap-3"
                  }
                >
                  {message.role === "assistant" ? (
                    <Avatar size="sm">
                      <AvatarFallback>
                        <Bot />
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  <Card
                    size="sm"
                    className={
                      message.role === "user"
                        ? "max-w-[72ch] bg-primary text-primary-foreground"
                        : message.content.startsWith("오류:")
                          ? "max-w-[72ch] text-destructive"
                          : "max-w-[72ch]"
                    }
                  >
                    <CardContent className="leading-6">
                      {message.role === "assistant" ? (
                        <AssistantBody text={message.content || "생각 중..."} />
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {formatMessage(message.content)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {message.role === "user" ? (
                    <Avatar size="sm">
                      <AvatarFallback>
                        <UserRound />
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="mt-auto border-t border-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => send(item.prompt)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Separator className="mb-3" />
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void send(input)
              }}
            >
              <Textarea
                value={input}
                disabled={pending}
                placeholder="예: 내부 ALB 이름 지어줘"
                className="min-h-12 resize-none"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void send(input)
                  }
                }}
              />
              <Button type="submit" disabled={pending || !input.trim()}>
                <Send data-icon="inline-start" />
                보내기
              </Button>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
