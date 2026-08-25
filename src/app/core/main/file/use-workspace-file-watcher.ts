'use client'

import { appDataDir, join } from '@tauri-apps/api/path'
import { watch, type WatchEvent } from '@tauri-apps/plugin-fs'
import { useEffect } from 'react'

import useSettingStore from '@/stores/setting'
import useArticleStore from '@/stores/article'
import { getSelfHostedSyncRuntime } from '@/lib/self-hosted-sync/runtime'

function isStructuralEvent(event: WatchEvent) {
  if (event.type === 'any' || event.type === 'other') return true
  if ('create' in event.type || 'remove' in event.type) return true
  return 'modify' in event.type && event.type.modify.kind === 'rename'
}

export function useWorkspaceFileWatcher() {
  const workspacePath = useSettingStore(state => state.workspacePath)

  useEffect(() => {
    let disposed = false
    let unwatch: (() => void) | undefined

    async function startWatching() {
      const workspaceRoot = workspacePath
        ? workspacePath
        : await join(await appDataDir(), 'article')
      const normalizedRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')

      unwatch = await watch(workspaceRoot, event => {
        if (disposed) return
        void getSelfHostedSyncRuntime().wake('file-watcher')

        const relativePaths = event.paths.map(path => {
          const normalizedPath = path.replace(/\\/g, '/')
          if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
            return normalizedPath.slice(normalizedRoot.length + 1)
          }
          return normalizedPath.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedPath)
            ? ''
            : normalizedPath.replace(/^\.?\//, '')
        }).filter(path => path && !path.split('/').some(part => part.startsWith('.')))

        if (!isStructuralEvent(event)) {
          for (const relativePath of relativePaths) {
            useArticleStore.getState().markFileDirty(relativePath)
          }
          return
        }

        const state = useArticleStore.getState()
        if (typeof event.type !== 'string' && 'create' in event.type && event.type.create.kind === 'file') {
          const updated = relativePaths
            .map(path => state.reconcileLocalFile(path, true))
            .every(Boolean)
          if (updated) return
        }

        if (typeof event.type !== 'string' && 'remove' in event.type && event.type.remove.kind === 'file') {
          const updated = relativePaths
            .map(path => state.reconcileLocalFile(path, false))
            .every(Boolean)
          if (updated) return
        }

        if (
          typeof event.type !== 'string'
          && 'modify' in event.type
          && event.type.modify.kind === 'rename'
        ) {
          const mode = event.type.modify.mode
          if ((mode === 'both' || mode === 'any') && relativePaths.length >= 2) {
            const oldPath = relativePaths[0]
            const newPath = relativePaths[relativePaths.length - 1]
            state.reconcileLocalFile(oldPath, false)
            state.reconcileLocalFile(newPath, true)
          }

          // Windows reports rename operations as separate `from`/`to` events, while
          // other platforms may provide both paths together. The event itself does
          // not reliably identify whether the moved entry is a file or directory,
          // so the optimistic reconciliation above is only immediate feedback. Let
          // the directory scan below make the file tree match the filesystem.
        }

        const parentPaths = new Set(relativePaths.map(path => {
          const parts = path.split('/')
          parts.pop()
          return parts.join('/')
        }))

        if (parentPaths.has('') || parentPaths.size === 0) {
          void useArticleStore.getState().loadFileTree({ skipRemoteSync: true })
          return
        }

        for (const parentPath of parentPaths) {
          void useArticleStore.getState().loadCollapsibleFiles(parentPath, {
            force: true,
            skipRemoteSync: true,
          })
        }
      }, {
        recursive: true,
        delayMs: 300,
      })
    }

    void startWatching().catch(error => {
      console.warn('Workspace file watcher unavailable:', error)
    })

    return () => {
      disposed = true
      unwatch?.()
    }
  }, [workspacePath])
}
