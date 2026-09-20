import { useMemo, useState } from "react"
import { ChevronDown, FileText } from "lucide-react"
import { marked } from "marked"

import conventionMarkdown from "../../knowledge/ASSAC_naming_convention.md?raw"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const conventionHtml = marked.parse(conventionMarkdown, {
  gfm: true,
  async: false,
}) as string

export function ConventionDropdown() {
  const [open, setOpen] = useState(false)
  const html = useMemo(() => conventionHtml, [])

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
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium">ASSAC 네이밍 컨벤션</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOpen(false)}
            >
              닫기
            </Button>
          </div>
          <ScrollArea className="h-[min(70vh,36rem)]">
            <div
              className="convention-doc px-4 py-4"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
