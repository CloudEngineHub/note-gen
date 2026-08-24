"use client"

import { ModelSelect } from "./model-select"
import { PromptSelect } from "./prompt-select"
import { cn } from '@/lib/utils'

export function ChatFooter({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={cn(
      'flex h-6 min-w-0 items-center gap-2 overflow-hidden bg-background text-xs text-muted-foreground',
      embedded ? 'w-auto shrink-0 justify-start' : 'w-full justify-between border-t border-border px-1',
    )}>
      <ModelSelect display="status" />
      <PromptSelect display="status" />
    </div>
  )
}
