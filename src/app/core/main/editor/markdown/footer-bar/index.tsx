'use client'

import { Editor } from '@tiptap/react'
import { Code2, Eye } from 'lucide-react'
import { WordCount } from './word-count'
import { CopyButton } from './copy-button'
import { ExportButton } from './export-button'
import { SyncTools } from '../sync/sync-tools'
import { OutlineToggle } from './outline-toggle'
import { SyncButton } from '../sync/sync-button'
import { PullButton } from '../sync/pull-button'
import { HistorySheet } from '../sync/history-sheet'
import { isMobileDevice } from '@/lib/check'
import { Button } from '@/components/ui/button'
import useSettingStore from '@/stores/setting'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface FooterBarProps {
  editor: Editor
  outlineOpen?: boolean
  onToggleOutline?: () => void
  viewMode?: 'visual' | 'source'
  onToggleViewMode?: () => void
  sourceMarkdown?: string
  getMarkdown?: () => string
  prepareExternalAction?: () => boolean
  onMarkdownChange?: (markdown: string) => void
  deferSourceStatistics?: boolean
  embedded?: boolean
}

export function FooterBar({
  editor,
  outlineOpen,
  onToggleOutline,
  viewMode = 'visual',
  onToggleViewMode,
  sourceMarkdown,
  getMarkdown,
  prepareExternalAction,
  onMarkdownChange,
  deferSourceStatistics = false,
  embedded = false,
}: FooterBarProps) {
  const isMobile = isMobileDevice()
  const showEditorStats = useSettingStore((state) => state.showEditorStats)
  const primaryBackupMethod = useSettingStore((state) => state.primaryBackupMethod)
  const tSourceMode = useTranslations('settings.editor.sourceMode')
  if (isMobile) {
    return (
      <div className="mobile-editor-footer flex h-7 select-none items-center justify-between gap-3 border-t border-border bg-background px-3 text-xs text-muted-foreground">
        <div className="min-w-0 flex-1">
          {showEditorStats && !deferSourceStatistics ? (
            <WordCount editor={editor} sourceMarkdown={sourceMarkdown} compact />
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {onToggleViewMode ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title={tSourceMode(viewMode)}
              aria-label={tSourceMode(viewMode)}
              onClick={onToggleViewMode}
            >
              {viewMode === 'source' ? <Code2 /> : <Eye />}
              <span>{tSourceMode(viewMode)}</span>
            </Button>
          ) : null}
          {primaryBackupMethod !== 'selfHosted' ? (
            <>
              <HistorySheet editor={editor} prepareExternalAction={prepareExternalAction} onMarkdownChange={onMarkdownChange} />
              <SyncButton getMarkdown={getMarkdown} prepareExternalAction={prepareExternalAction} />
              <PullButton
                editor={editor}
                markdown={sourceMarkdown}
                getMarkdown={getMarkdown}
                prepareExternalAction={prepareExternalAction}
                onMarkdownChange={onMarkdownChange}
              />
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex h-6 min-w-0 select-none items-center overflow-hidden bg-background text-xs text-muted-foreground',
      embedded ? 'w-full justify-between gap-2' : 'w-full justify-between border-t border-border px-3',
    )}>
      {/* Left side: Word count, Copy, Export, Outline */}
      <div className="flex items-center gap-1">
        {showEditorStats && !deferSourceStatistics ? (
          <WordCount editor={editor} sourceMarkdown={sourceMarkdown} />
        ) : null}
        {onToggleViewMode ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title={tSourceMode(viewMode)}
            aria-label={tSourceMode(viewMode)}
            onClick={onToggleViewMode}
          >
            {viewMode === 'source' ? <Code2 /> : <Eye />}
            <span>{tSourceMode(viewMode)}</span>
          </Button>
        ) : null}
        <CopyButton editor={editor} markdown={sourceMarkdown} getMarkdown={getMarkdown} />
        <ExportButton editor={editor} markdown={sourceMarkdown} getMarkdown={getMarkdown} />
        {onToggleOutline ? (
          <OutlineToggle
            editor={editor}
            outlineOpen={outlineOpen}
            onToggleOutline={onToggleOutline}
          />
        ) : null}
      </div>

      {/* Right side: Sync tools */}
      <SyncTools
        editor={editor}
        markdown={sourceMarkdown}
        getMarkdown={getMarkdown}
        prepareExternalAction={prepareExternalAction}
        onMarkdownChange={onMarkdownChange}
      />
    </div>
  )
}

export default FooterBar
