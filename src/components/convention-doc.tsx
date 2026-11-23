import { useState } from "react"
import { ChevronDown, FileText } from "lucide-react"
import { marked } from "marked"

import finalMarkdown from "../../knowledge/ASSAC_final_naming_convention.md?raw"
import midtermMarkdown from "../../knowledge/ASSAC_naming_convention.md?raw"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const DOCS = [
  {
    key: "final",
    label: "최종 프로젝트",
    title: "ASSAC 최종 프로젝트 네이밍 컨벤션",
    html: marked.parse(finalMarkdown, { gfm: true, async: false }) as string,
  },
  {
    key: "midterm",
    label: "중간 프로젝트",
    title: "ASSAC 중간 프로젝트(petclinic) 네이밍 컨벤션",
    html: marked.parse(midtermMarkdown, { gfm: true, async: false }) as string,
  },
] as const

type DocKey = (typeof DOCS)[number]["key"]

export function ConventionDropdown() {
  const [open, setOpen] = useState(false)
  const [docKey, setDocKey] = useState<DocKey>("final")
  const doc = DOCS.find((item) => item.key === docKey) ?? DOCS[0]

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FileText data-icon="inline-start" />
        컨벤션 문서
        <ChevronDown className={open ? "rotate-180" : undefined} />
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-1" role="tablist">
              {DOCS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={item.key === docKey}
                  variant={item.key === docKey ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setDocKey(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOpen(false)}
            >
              닫기
            </Button>
          </div>
          <p className="border-b border-border px-4 py-2 text-sm font-medium">
            {doc.title}
          </p>
          <ScrollArea className="h-[min(70vh,36rem)]">
            <div
              className="convention-doc px-4 py-4"
              dangerouslySetInnerHTML={{ __html: doc.html }}
            />
          </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
