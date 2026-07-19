"use client"

import useSettingStore from "@/stores/setting"
import { ModelSelect } from "./model-select"
import { PromptSelect } from "./prompt-select"

export function ChatFooter() {
  const { chatToolbarConfigPc } = useSettingStore()
  const modelSelectorEnabled = chatToolbarConfigPc.find((item) => item.id === 'modelSelect')?.enabled ?? true
  const promptSelectorEnabled = chatToolbarConfigPc.find((item) => item.id === 'promptSelect')?.enabled ?? true

  return (
    <footer className="flex h-6 w-full items-center justify-between border-t border-border bg-background px-1 text-xs text-muted-foreground">
      <ModelSelect display="status" disabled={!modelSelectorEnabled} />
      <PromptSelect display="status" disabled={!promptSelectorEnabled} />
    </footer>
  )
}
