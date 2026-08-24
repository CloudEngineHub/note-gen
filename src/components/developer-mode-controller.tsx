'use client'

import { useEffect } from 'react'
import { closeDeveloperTools, openDeveloperTools, supportsNativeDeveloperTools } from '@/lib/developer-tools'
import { clearRuntimeLogs } from '@/lib/diagnostics/runtime-log-buffer'
import useSettingStore from '@/stores/setting'

export function DeveloperModeController() {
  const developerMode = useSettingStore(state => state.developerMode)

  useEffect(() => {
    const nativeDeveloperToolsSupported = supportsNativeDeveloperTools()
    const handleKeyDown = (event: KeyboardEvent) => {
      const isDeveloperShortcut = event.key === 'F12'
        || (event.key.toLowerCase() === 'i' && (event.metaKey || event.ctrlKey) && event.shiftKey)
      if (!isDeveloperShortcut) return

      event.preventDefault()
      if (developerMode && nativeDeveloperToolsSupported) void openDeveloperTools()
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (!developerMode || !nativeDeveloperToolsSupported) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [developerMode])

  useEffect(() => {
    if (developerMode) return
    clearRuntimeLogs()
    if (supportsNativeDeveloperTools()) void closeDeveloperTools().catch(() => undefined)
  }, [developerMode])

  return null
}
