'use client'

import { Button } from "@/components/ui/button"
import { FolderOpen, ChevronDown, FolderPlus, X } from "lucide-react"
import useSettingStore from "@/stores/setting"
import useArticleStore from "@/stores/article"
import { useSkillsStore } from "@/stores/skills"
import { useTranslations } from 'next-intl'
import { useMemo, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { getWorkspaceDisplayName } from "@/lib/workspace-name"
import { useSyncAvailability } from "./use-sync-availability"
import { toast } from '@/hooks/use-toast'

export function FileFooter() {
  const { workspacePath, workspaceHistory, setWorkspacePath, removeWorkspaceHistory } = useSettingStore()
  const { refreshSkills } = useSkillsStore()
  const {
    loadWorkspaceCollapsibleList,
    loadFileTree,
    setActiveFilePath,
    setCurrentArticle
  } = useArticleStore()
  const tFile = useTranslations('settings.file')
  const tContext = useTranslations('article.file.context')
  const sync = useSyncAvailability()
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false)

  // 当前工作区名称
  const currentWorkspaceName = useMemo(() => {
    return getWorkspaceDisplayName(workspacePath, tFile('workspace.defaultPath'))
  }, [workspacePath, tFile])

  // 选择工作区目录
  async function handleSelectWorkspace() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: tFile('workspace.select')
      })
      
      if (selected) {
        const path = selected as string
        await switchWorkspace(path)
      }
    } catch (error) {
      console.error('选择工作区失败:', error)
    }
  }

  // 切换工作区
  async function switchWorkspace(path: string) {
    if (path === workspacePath || switchingWorkspace) return

    const previousWorkspacePath = workspacePath
    setSwitchingWorkspace(true)
    try {
      await setWorkspacePath(path)
      setActiveFilePath('')
      setCurrentArticle('')
      const lastActivePath = await loadWorkspaceCollapsibleList()
      await loadFileTree()
      if (lastActivePath) await setActiveFilePath(lastActivePath)
      await refreshSkills()
    } catch (error) {
      console.error('切换工作区失败:', error)
      await setWorkspacePath(previousWorkspacePath)
      await loadWorkspaceCollapsibleList()
      await loadFileTree()
      toast({ title: tFile('workspace.switchFailed'), variant: 'destructive' })
    } finally {
      setSwitchingWorkspace(false)
    }
  }

  // 重置为默认工作区
  async function handleResetWorkspace() {
    if (switchingWorkspace) return

    const previousWorkspacePath = workspacePath
    setSwitchingWorkspace(true)
    try {
      await setWorkspacePath('')
      setActiveFilePath('')
      setCurrentArticle('')
      const lastActivePath = await loadWorkspaceCollapsibleList()
      await loadFileTree()
      if (lastActivePath) await setActiveFilePath(lastActivePath)
      await refreshSkills()
    } catch (error) {
      console.error('重置工作区失败:', error)
      await setWorkspacePath(previousWorkspacePath)
      await loadWorkspaceCollapsibleList()
      await loadFileTree()
      toast({ title: tFile('workspace.switchFailed'), variant: 'destructive' })
    } finally {
      setSwitchingWorkspace(false)
    }
  }

  return (
    <div className="flex h-6 min-h-6 max-h-6 shrink-0 items-center justify-between gap-1 overflow-hidden border-t border-border bg-background px-2 text-xs text-muted-foreground">
      <span
        className={`size-1.5 shrink-0 rounded-full ${sync.configured ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
        title={sync.configured
          ? tContext('syncConfigured', { platform: sync.platform })
          : tContext('syncNotConfigured')}
        aria-label={sync.configured
          ? tContext('syncConfigured', { platform: sync.platform })
          : tContext('syncNotConfigured')}
      />
      {/* 左侧：工作区选择器 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            disabled={switchingWorkspace}
            className="flex h-5 flex-1 justify-between border-0 bg-transparent px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-ring/30"
          >
            <span className="truncate text-xs">{currentWorkspaceName}</span>
            <ChevronDown className="ml-1 size-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {/* 选择新工作区 */}
          <DropdownMenuLabel>{tFile('workspace.actions')}</DropdownMenuLabel>
          <DropdownMenuItem disabled={switchingWorkspace} onClick={handleSelectWorkspace}>
            <FolderPlus className="mr-2 h-4 w-4" />
            {tFile('workspace.select')}
          </DropdownMenuItem>
          {workspacePath && (
            <DropdownMenuItem disabled={switchingWorkspace} onClick={handleResetWorkspace}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {tFile('workspace.defaultPath')}
            </DropdownMenuItem>
          )}
          
          {/* 历史工作区 */}
          {workspaceHistory.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{tFile('workspace.history')}</DropdownMenuLabel>
              {workspaceHistory.map((path) => (
                <DropdownMenuSub key={path}>
                  <DropdownMenuSubTrigger disabled={switchingWorkspace}>
                    <FolderOpen />
                    <span className="max-w-56 truncate" title={path}>
                      {getWorkspaceDisplayName(path, tFile('workspace.defaultPath'))}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => void switchWorkspace(path)}>
                      <FolderOpen />
                      {tFile('workspace.selectFromHistory')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void removeWorkspaceHistory(path)}
                    >
                      <X />
                      {tFile('workspace.removeHistory')}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </>
          )}
          
          {/* 默认工作区 */}
          {!workspacePath && workspaceHistory.length === 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <FolderOpen className="mr-2 h-4 w-4" />
                {tFile('workspace.defaultPath')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

    </div>
  )
}
