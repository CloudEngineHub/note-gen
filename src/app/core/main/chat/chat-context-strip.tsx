"use client"

import {
  ChartArea,
  ChartColumn,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  FileText,
  FolderOpen,
  Gauge,
  Package,
  Palette,
  Radar,
  TextSelect,
  Waypoints,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isLinkedFolder, type LinkedResource } from "@/lib/files"
import type { PendingQuote } from "@/stores/chat"
import type { CanvasSelectionContext } from "@/types/canvas"
import type { SkillMetadata } from "@/lib/skills/types"
import type { MarkdownFile } from "@/lib/files"
import type { Mark } from "@/db/marks"
import {
  getMarkTypeIconClasses,
  MARK_TYPE_ICONS,
} from "@/app/core/main/mark/mark-type-meta"

export interface MentionedRecord extends PendingQuote {
  markType: Mark["type"]
}

export type MentionedContext =
  | { kind: "file"; file: MarkdownFile }
  | { kind: "record"; record: MentionedRecord }
  | { kind: "canvas"; canvas: CanvasSelectionContext }

export function getMentionedContextKey(context: MentionedContext) {
  if (context.kind === "file") return `file:${context.file.path}`
  if (context.kind === "record") return `record:${context.record.articlePath}`
  return `canvas:${context.canvas.canvasId}`
}

interface ChatContextStripProps {
  linkedResource: LinkedResource | null
  activeTabContexts: MentionedContext[]
  quoteData: PendingQuote | null
  canvasContext: CanvasSelectionContext | null
  selectedSkills: SkillMetadata[]
  mentionedContexts: MentionedContext[]
  onRemoveLinkedResource: () => void
  onRemoveActiveTabContext: (key: string) => void
  onRemoveQuote: () => void
  onRemoveCanvas: () => void
  onRemoveSkill: (skillId: string) => void
  onRemoveMentionedContext: (key: string) => void
}

function ContextBadge({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode
  label: string
  onRemove: () => void
}) {
  return (
    <Badge
      variant="secondary"
      className="h-7 max-w-40 shrink-0 gap-1 rounded-lg pl-2 pr-0.5 font-normal"
      title={label}
    >
      <span
        className="flex size-3.5 shrink-0 items-center justify-center self-center [&>svg]:size-3.5!"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="truncate leading-none">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        onClick={onRemove}
        aria-label={label}
      >
        <X />
      </Button>
    </Badge>
  )
}

function getQuoteLabel(quote: PendingQuote) {
  const selectedText = quote.quote.replace(/\s+/g, " ").trim()

  if (quote.startLine <= 0 || quote.endLine < quote.startLine) {
    return selectedText || quote.fileName
  }

  const selectedLines = quote.startLine === quote.endLine
    ? `L${quote.startLine}`
    : `L${quote.startLine}–${quote.endLine}`

  return selectedText ? `${selectedLines} · ${selectedText}` : selectedLines
}

function getCanvasContextLabel(
  context: CanvasSelectionContext,
  formatNodes: (nodes: number) => string,
  formatNodesAndRelations: (nodes: number, relations: number) => string
) {
  if (context.scope === "canvas" || context.nodes.length === 0) {
    return context.canvasTitle
  }

  const nodeLabels = new Map(
    context.nodes.map(node => [node.id, node.label.replace(/\s+/g, " ").trim() || node.id])
  )
  const selectedNodes = [...nodeLabels.values()]
  if (selectedNodes.length === 1) {
    return selectedNodes[0]
  }

  const relationshipCount = context.edges.filter(edge => (
    nodeLabels.has(edge.source) && nodeLabels.has(edge.target)
  )).length

  return relationshipCount > 0
    ? formatNodesAndRelations(selectedNodes.length, relationshipCount)
    : formatNodes(selectedNodes.length)
}

function getCanvasContextIcon(context: CanvasSelectionContext) {
  if (context.scope === "canvas") return <Palette />
  if (context.nodes.length !== 1 || context.nodes[0].type !== "chart") return <Waypoints />

  switch (context.nodes[0].chart?.type) {
    case "area":
      return <ChartArea />
    case "bar":
      return <ChartColumn />
    case "line":
      return <ChartLine />
    case "pie":
      return <ChartPie />
    case "radar":
      return <Radar />
    case "radial":
      return <Gauge />
    default:
      return <ChartNoAxesCombined />
  }
}

function CanvasContextBadge({
  context,
  onRemove,
}: {
  context: CanvasSelectionContext
  onRemove: () => void
}) {
  const t = useTranslations("canvas.selection")
  const label = getCanvasContextLabel(
    context,
    nodes => t("chatContextNodes", { nodes }),
    (nodes, relations) => t("chatContextNodesAndRelations", { nodes, relations })
  )

  return (
    <ContextBadge
      icon={getCanvasContextIcon(context)}
      label={label}
      onRemove={onRemove}
    />
  )
}

function MentionedContextBadge({
  context,
  onRemove,
}: {
  context: MentionedContext
  onRemove: () => void
}) {
  if (context.kind === "file") {
    return <ContextBadge icon={<FileText />} label={context.file.name} onRemove={onRemove} />
  }
  if (context.kind === "record") {
    const RecordIcon = MARK_TYPE_ICONS[context.record.markType]
    return (
      <ContextBadge
        icon={<RecordIcon className={getMarkTypeIconClasses(context.record.markType)} />}
        label={context.record.fileName}
        onRemove={onRemove}
      />
    )
  }
  return <CanvasContextBadge context={context.canvas} onRemove={onRemove} />
}

export function ChatContextStrip({
  linkedResource,
  activeTabContexts,
  quoteData,
  canvasContext,
  selectedSkills,
  mentionedContexts,
  onRemoveLinkedResource,
  onRemoveActiveTabContext,
  onRemoveQuote,
  onRemoveCanvas,
  onRemoveSkill,
  onRemoveMentionedContext,
}: ChatContextStripProps) {
  if (
    !linkedResource
    && activeTabContexts.length === 0
    && !quoteData
    && !canvasContext
    && selectedSkills.length === 0
    && mentionedContexts.length === 0
  ) return null

  return (
    <div className="flex w-full max-w-full flex-wrap gap-1 px-1 pt-1">
      {linkedResource ? (
        <ContextBadge
          icon={isLinkedFolder(linkedResource) ? <FolderOpen /> : <FileText />}
          label={linkedResource.name}
          onRemove={onRemoveLinkedResource}
        />
      ) : null}
      {activeTabContexts.map(context => {
        const key = getMentionedContextKey(context)
        return (
          <MentionedContextBadge
            key={key}
            context={context}
            onRemove={() => onRemoveActiveTabContext(key)}
          />
        )
      })}
      {quoteData ? (
        <ContextBadge
          icon={<TextSelect />}
          label={getQuoteLabel(quoteData)}
          onRemove={onRemoveQuote}
        />
      ) : null}
      {canvasContext ? (
        <CanvasContextBadge context={canvasContext} onRemove={onRemoveCanvas} />
      ) : null}
      {mentionedContexts.map(context => {
        const key = getMentionedContextKey(context)
        return (
          <MentionedContextBadge
            key={key}
            context={context}
            onRemove={() => onRemoveMentionedContext(key)}
          />
        )
      })}
      {selectedSkills.map(skill => (
        <ContextBadge
          key={skill.id}
          icon={<Package />}
          label={skill.name}
          onRemove={() => onRemoveSkill(skill.id)}
        />
      ))}
    </div>
  )
}
