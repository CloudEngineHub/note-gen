'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Store } from '@tauri-apps/plugin-store'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Layout } from 'react-resizable-panels'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import emitter, { type Events } from '@/lib/emitter'
import useArticleStore, { findFolderInTree, type DirTree } from '@/stores/article'
import useMarkStore from '@/stores/mark'
import useCanvasStore from '@/stores/canvas'
import useChatStore from '@/stores/chat'
import { useSidebarStore } from '@/stores/sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { OnboardingSpotlight } from '@/components/onboarding-spotlight'
import { TabContentErrorBoundary } from '@/components/tab-content-error-boundary'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MdEditor } from './markdown/md-editor-wrapper'
import { TabBar, type TabInfo } from './tab-bar'
import { ImageEditor } from './image/image-editor'
import { EmptyState } from './empty-state'
import { FolderView } from './folder'
import { UnsupportedFile } from './unsupported-file'
import { MarkDetailPanel } from '../mark/mark-detail-panel'
import { getRecordIdFromTabPath, isRecordTabPath } from '../mark/mark-record-tab'
import { getCanvasIdFromTabPath, isCanvasTabPath } from '../canvas/canvas-tab'
import { focusEditorWindowForPath, openEditorWindow } from '@/lib/editor-windows'
import { prepareActiveEditorDeactivationDurably } from '@/lib/editor-deactivation'
import { computedParentPath } from '@/lib/path'
import {
  closeEditorGroup,
  createEditorWorkspaceLayout,
  getEditorGroupIds,
  moveEditorTab,
  normalizeEditorWorkspaceLayout,
  removeTabFromEditorGroup,
  setActiveEditorGroupTab,
  splitEditorGroup,
  tabIsReferenced,
  updateEditorSplitSizes,
  type EditorGroup,
  type EditorLayoutNode,
  type EditorSplitDirection,
  type EditorWorkspaceLayout,
} from './editor-group-layout'
import {
  createDefaultOnboardingProgress,
  getCompletionFeedbackMode,
  getActiveOnboardingStep,
  markOnboardingStepDone,
  normalizeOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStepId,
} from './onboarding-state'
import {
  findRecentOnboardingFile,
  getOnboardingAgentPrompt,
  getOnboardingSpotlightTarget,
  ONBOARDING_SAMPLE_RECORD,
} from './empty-state-actions'

const MARKDOWN_EXTENSIONS = new Set([
  'md', 'txt', 'markdown', 'py', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less',
  'html', 'xml', 'json', 'yaml', 'yml', 'sh', 'bash', 'java', 'c', 'cpp', 'h', 'go',
  'rs', 'sql', 'rb', 'php', 'vue', 'svelte', 'astro', 'toml', 'ini', 'conf', 'cfg',
  'gitignore', 'env', 'example', 'template',
])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'])
const ONBOARDING_PROGRESS_STORE_KEY = 'desktopOnboardingProgress'
const EDITOR_LAYOUT_STORE_KEY = 'editorWorkspaceLayout:main'
const CanvasEditor = dynamic(
  () => import('../canvas/canvas-editor').then(module => module.CanvasEditor),
  { ssr: false },
)

const editorCollisionDetection: CollisionDetection = args => {
  if (!args.pointerCoordinates) return closestCenter(args)
  const collisions = pointerWithin(args)
  const priority = (id: string | number) => {
    const value = String(id)
    if (value.startsWith('editor-drop:')) return 0
    if (value.startsWith('editor-tab:')) return 1
    if (value.startsWith('editor-tab-list:')) return 2
    return 3
  }
  return [...collisions].sort((left, right) => priority(left.id) - priority(right.id))
}

function findPathInTree(path: string, tree: DirTree[]): DirTree | null {
  for (const item of tree) {
    if (computedParentPath(item) === path) return item
    const nested = item.children ? findPathInTree(path, item.children) : null
    if (nested) return nested
  }
  return null
}

interface DropZoneProps {
  groupId: string
  direction: EditorSplitDirection | 'center'
  className: string
  visible: boolean
}

function EditorDropZone({ groupId, direction, className, visible }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `editor-drop:${groupId}:${direction}`,
    data: { type: 'editor-drop-zone', groupId, direction },
  })
  if (!visible) return null
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'pointer-events-none absolute bg-primary/10 transition-colors',
        isOver && 'bg-primary/25 ring-2 ring-inset ring-primary/60',
        className,
      )}
    />
  )
}

interface EditorGroupPaneProps {
  group: EditorGroup
  tabs: TabInfo[]
  activeLayout: EditorWorkspaceLayout
  dragging: boolean
  onActivateGroup: (groupId: string, tabId?: string) => void
  onNewTab: (groupId: string) => void
  onCloseTab: (groupId: string, tabId: string) => void
  onKeepTabs: (groupId: string, keptTabIds: string[]) => void
  onSplitTab: (groupId: string, tabId: string, direction: EditorSplitDirection) => void
  onMoveToNewWindow: (groupId: string, tabId: string) => void
  onToggleMaximize: (groupId: string) => void
  onCloseGroup: (groupId: string) => void
  renderActiveContent: (tab: TabInfo, active: boolean, groupId: string) => React.ReactNode
  renderEmpty: (mode: 'new-tab' | 'empty-group') => React.ReactNode
}

function EditorGroupPane({
  group, tabs, activeLayout, dragging, onActivateGroup, onNewTab, onCloseTab,
  onKeepTabs, onSplitTab, onMoveToNewWindow, onToggleMaximize, onCloseGroup,
  renderActiveContent, renderEmpty,
}: EditorGroupPaneProps) {
  const groupTabs = group.tabIds
    .map(tabId => tabs.find(tab => tab.id === tabId))
    .filter((tab): tab is TabInfo => Boolean(tab))
  const activeTab = groupTabs.find(tab => tab.id === group.activeTabId)
  const isActiveGroup = activeLayout.activeGroupId === group.id

  return (
    <section
      className={cn('relative flex h-full w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background', isActiveGroup && 'editor-group-active')}
    >
      <TabBar
        groupId={group.id}
        tabs={groupTabs}
        activeTabId={group.activeTabId}
        isActiveGroup={isActiveGroup}
        isMaximized={activeLayout.maximizedGroupId === group.id}
        onTabSwitch={tabId => onActivateGroup(group.id, tabId)}
        onNewTab={() => onNewTab(group.id)}
        onCloseTab={tabId => onCloseTab(group.id, tabId)}
        onCloseOtherTabs={tabId => onKeepTabs(group.id, [tabId])}
        onCloseAllTabs={() => onKeepTabs(group.id, [])}
        onCloseLeftTabs={tabId => {
          const index = group.tabIds.indexOf(tabId)
          onKeepTabs(group.id, group.tabIds.slice(index))
        }}
        onCloseRightTabs={tabId => {
          const index = group.tabIds.indexOf(tabId)
          onKeepTabs(group.id, group.tabIds.slice(0, index + 1))
        }}
        onSplitTab={(tabId, direction) => onSplitTab(group.id, tabId, direction)}
        onMoveToNewWindow={tabId => onMoveToNewWindow(group.id, tabId)}
        onToggleMaximize={() => onToggleMaximize(group.id)}
        onCloseGroup={() => onCloseGroup(group.id)}
      />
      <div className="relative flex min-h-0 flex-1" onPointerDownCapture={() => onActivateGroup(group.id, group.activeTabId)}>
        {groupTabs.map(tab => (
          <div
            key={tab.id}
            className="min-h-0 min-w-0 flex-1 overflow-hidden"
            style={{ display: tab.id === activeTab?.id ? 'flex' : 'none' }}
          >
            {renderActiveContent(tab, isActiveGroup && tab.id === activeTab?.id, group.id)}
          </div>
        ))}
        {!activeTab && renderEmpty(groupTabs.length > 0 ? 'new-tab' : 'empty-group')}
        <EditorDropZone groupId={group.id} direction="left" visible={dragging} className="inset-y-0 left-0 z-20 w-1/4" />
        <EditorDropZone groupId={group.id} direction="right" visible={dragging} className="inset-y-0 right-0 z-20 w-1/4" />
        <EditorDropZone groupId={group.id} direction="up" visible={dragging} className="inset-x-1/4 top-0 z-20 h-1/4" />
        <EditorDropZone groupId={group.id} direction="down" visible={dragging} className="inset-x-1/4 bottom-0 z-20 h-1/4" />
        <EditorDropZone groupId={group.id} direction="center" visible={dragging} className="inset-1/4 z-10" />
      </div>
    </section>
  )
}

export function EditorLayout() {
  const {
    activeFilePath, fileTree, setActiveFilePath, openTabs, activeTabId,
    setActiveTabId, setOpenTabs, addTab, removeTab, initOpenTabs, initShowCloudFiles,
  } = useArticleStore(useShallow(state => ({
    activeFilePath: state.activeFilePath,
    fileTree: state.fileTree,
    setActiveFilePath: state.setActiveFilePath,
    openTabs: state.openTabs,
    activeTabId: state.activeTabId,
    setActiveTabId: state.setActiveTabId,
    setOpenTabs: state.setOpenTabs,
    addTab: state.addTab,
    removeTab: state.removeTab,
    initOpenTabs: state.initOpenTabs,
    initShowCloudFiles: state.initShowCloudFiles,
  })))
  const { setLeftSidebarTab, rightSidebarVisible, toggleRightSidebar } = useSidebarStore()
  const { setOnboardingPromptDraft } = useChatStore()
  const setActiveMarkId = useMarkStore(state => state.setActiveMarkId)
  const clearActiveMark = useMarkStore(state => state.clearActiveMark)
  const setActiveCanvasId = useCanvasStore(state => state.setActiveCanvasId)
  const tOnboarding = useTranslations('article.emptyState.onboarding')
  const tGroups = useTranslations('tabContext')

  const tabContentsRef = useRef<Record<string, string>>({})
  const [layout, setLayoutState] = useState<EditorWorkspaceLayout>(() => createEditorWorkspaceLayout([]))
  const layoutRef = useRef<EditorWorkspaceLayout>(layout)
  const layoutPersistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const suppressPanelLayoutUntilRef = useRef(0)
  const initializedRef = useRef(false)
  const currentOnboardingTaskRef = useRef<OnboardingStepId | null>(null)
  const [layoutReady, setLayoutReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [detachingTabId, setDetachingTabId] = useState('')
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress>(createDefaultOnboardingProgress())
  const [currentOnboardingTask, setCurrentOnboardingTask] = useState<OnboardingStepId | null>(null)
  const [activeOnboardingStep, setActiveOnboardingStep] = useState<OnboardingStepId | null>(null)
  const [completedOnboardingStep, setCompletedOnboardingStep] = useState<OnboardingStepId | null>(null)
  const [showOrganizeNextStepDialog, setShowOrganizeNextStepDialog] = useState(false)
  const [onboardingResumeFilePath, setOnboardingResumeFilePath] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const setLayout = useCallback((next: EditorWorkspaceLayout | ((current: EditorWorkspaceLayout) => EditorWorkspaceLayout)) => {
    setLayoutState(current => {
      const resolved = typeof next === 'function' ? next(current) : next
      layoutRef.current = resolved
      return resolved
    })
  }, [])

  const canDeactivateActiveEditor = useCallback(() => {
    let canDeactivate = true
    emitter.emit('editor-prepare-deactivate', {
      resolve: nextValue => { canDeactivate = canDeactivate && nextValue },
    })
    return canDeactivate
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void (async () => {
      await Promise.all([initOpenTabs(), initShowCloudFiles()])
      const articleState = useArticleStore.getState()
      const tabs = articleState.openTabs
      const store = await Store.load('store.json')
      const storedLayout = await store.get<EditorWorkspaceLayout>(EDITOR_LAYOUT_STORE_KEY)
      let restoredLayout = normalizeEditorWorkspaceLayout(storedLayout, tabs)
      const restoredGroup = Object.values(restoredLayout.groups)
        .find(group => group.tabIds.includes(articleState.activeTabId))
      if (restoredGroup && articleState.activeTabId) {
        restoredLayout = setActiveEditorGroupTab(restoredLayout, restoredGroup.id, articleState.activeTabId)
      }
      setLayout(restoredLayout)
      setLayoutReady(true)
    })().catch(error => {
      console.error('Failed to restore editor layout:', error)
      setLayout(createEditorWorkspaceLayout(useArticleStore.getState().openTabs))
      setLayoutReady(true)
    })
  }, [initOpenTabs, initShowCloudFiles, setLayout])

  useEffect(() => {
    if (!layoutReady) return
    setLayout(current => normalizeEditorWorkspaceLayout(current, openTabs))
  }, [layoutReady, openTabs, setLayout])

  useEffect(() => {
    if (!layoutReady) return
    const timer = window.setTimeout(() => {
      layoutPersistQueueRef.current = layoutPersistQueueRef.current.catch(() => undefined).then(async () => {
        const store = await Store.load('store.json')
        await store.set(EDITOR_LAYOUT_STORE_KEY, layout)
        await store.save()
      }).catch(error => {
        console.error('Failed to persist editor layout:', error)
      })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [layout, layoutReady])

  useEffect(() => {
    const handleFileContentUpdated = (event: Events['editor-file-content-updated']) => {
      tabContentsRef.current[event.path] = event.content
      queueMicrotask(() => emitter.emit('sync-content-updated', event))
    }
    const handleFilePathChanged = (event: Events['editor-file-path-changed']) => {
      const content = event.content ?? tabContentsRef.current[event.oldPath]
      delete tabContentsRef.current[event.oldPath]
      if (typeof content === 'string') tabContentsRef.current[event.newPath] = content
    }
    emitter.on('editor-file-content-updated', handleFileContentUpdated)
    emitter.on('editor-file-path-changed', handleFilePathChanged)
    return () => {
      emitter.off('editor-file-content-updated', handleFileContentUpdated)
      emitter.off('editor-file-path-changed', handleFilePathChanged)
    }
  }, [])

  useEffect(() => {
    currentOnboardingTaskRef.current = currentOnboardingTask
  }, [currentOnboardingTask])

  const persistOnboardingProgress = useCallback(async (progress: OnboardingProgress) => {
    const store = await Store.load('store.json')
    await store.set(ONBOARDING_PROGRESS_STORE_KEY, progress)
    await store.save()
  }, [])

  useEffect(() => {
    void Store.load('store.json').then(async store => {
      const saved = await store.get<OnboardingProgress>(ONBOARDING_PROGRESS_STORE_KEY)
      setOnboardingProgress(normalizeOnboardingProgress(saved))
    })
  }, [])

  useEffect(() => {
    const handleComplete = ({ step, filePath }: Events['onboarding-step-complete']) => {
      setOnboardingProgress(current => {
        if (current.steps[step]) return current
        const next = markOnboardingStepDone(current, step)
        const feedbackMode = getCompletionFeedbackMode(step, currentOnboardingTaskRef.current)
        if (feedbackMode === 'dialog') {
          setOnboardingResumeFilePath(filePath || activeFilePath)
          setCurrentOnboardingTask(null)
          setActiveOnboardingStep(null)
          setCompletedOnboardingStep(null)
          setShowOrganizeNextStepDialog(true)
        } else if (currentOnboardingTaskRef.current) {
          setCurrentOnboardingTask(null)
          setActiveOnboardingStep(null)
          setCompletedOnboardingStep(step)
        }
        void persistOnboardingProgress(next)
        return next
      })
    }
    emitter.on('onboarding-step-complete', handleComplete)
    return () => emitter.off('onboarding-step-complete', handleComplete)
  }, [activeFilePath, persistOnboardingProgress])

  const isRecordEditorTab = useCallback((tab: TabInfo) => tab.kind === 'record' || isRecordTabPath(tab.path), [])
  const isCanvasEditorTab = useCallback((tab: TabInfo) => tab.kind === 'canvas' || isCanvasTabPath(tab.path), [])
  const getRecordIdForTab = useCallback((tab: TabInfo) => tab.markId ?? getRecordIdFromTabPath(tab.path), [])
  const isFolderPath = useCallback((path: string) => !(path.split(/[\\/]/).pop() || '').includes('.'), [])

  const getItemType = useCallback((path: string): 'markdown' | 'image' | 'folder' | 'unknown' => {
    if (!path) return 'unknown'
    if (findFolderInTree(path, fileTree)) return 'folder'
    const extension = path.split('.').pop()?.toLowerCase()
    if (!extension) return 'unknown'
    if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
    if (IMAGE_EXTENSIONS.has(extension)) return 'image'
    return 'unknown'
  }, [fileTree])

  const checkPathExists = useCallback(async (path: string) => {
    try {
      const [{ exists }, { getFilePathOptions }] = await Promise.all([
        import('@tauri-apps/plugin-fs'),
        import('@/lib/workspace'),
      ])
      const options = await getFilePathOptions(path)
      return options.baseDir
        ? await exists(options.path, { baseDir: options.baseDir })
        : await exists(options.path)
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!layoutReady || !openTabs.length) return
    let disposed = false
    void (async () => {
      const invalidIds = new Set<string>()
      for (const tab of openTabs) {
        if (isRecordEditorTab(tab) || isCanvasEditorTab(tab)) continue
        const existsInTree = Boolean(findPathInTree(tab.path, fileTree))
        if (tab.isFolder ? !existsInTree : !existsInTree && !await checkPathExists(tab.path)) {
          invalidIds.add(tab.id)
          delete tabContentsRef.current[tab.path]
        }
      }
      if (disposed || !invalidIds.size) return
      const currentTabs = useArticleStore.getState().openTabs
      await setOpenTabs(currentTabs.filter(tab => !invalidIds.has(tab.id)))
    })()
    return () => { disposed = true }
  }, [checkPathExists, fileTree, isCanvasEditorTab, isRecordEditorTab, layoutReady, openTabs, setOpenTabs])

  useEffect(() => {
    const restoredActiveTab = openTabs.find(tab => tab.id === activeTabId)
    setActiveCanvasId(
      restoredActiveTab && isCanvasEditorTab(restoredActiveTab)
        ? getCanvasIdFromTabPath(restoredActiveTab.path)
        : null
    )
  }, [activeTabId, isCanvasEditorTab, openTabs, setActiveCanvasId])

  const activateTab = useCallback(async (groupId: string, tab?: TabInfo | null) => {
    const currentGlobalTab = useArticleStore.getState().activeTabId
    if (tab?.id !== currentGlobalTab && !canDeactivateActiveEditor()) return false
    setLayout(current => setActiveEditorGroupTab(current, groupId, tab?.id ?? ''))
    if (!tab) {
      clearActiveMark()
      setActiveCanvasId(null)
      await Promise.all([setActiveTabId(''), setActiveFilePath('')])
      return true
    }
    const persistActiveTab = Promise.resolve(setActiveTabId(tab.id))
    if (isRecordEditorTab(tab)) {
      setActiveMarkId(getRecordIdForTab(tab))
      setActiveCanvasId(null)
      await Promise.all([persistActiveTab, setActiveFilePath('')])
    } else if (isCanvasEditorTab(tab)) {
      clearActiveMark()
      setActiveCanvasId(getCanvasIdFromTabPath(tab.path))
      await Promise.all([persistActiveTab, setActiveFilePath('')])
    } else {
      clearActiveMark()
      setActiveCanvasId(null)
      await Promise.all([persistActiveTab, setActiveFilePath(tab.path)])
    }
    return true
  }, [canDeactivateActiveEditor, clearActiveMark, getRecordIdForTab, isCanvasEditorTab, isRecordEditorTab, setActiveCanvasId, setActiveFilePath, setActiveMarkId, setActiveTabId, setLayout])

  useEffect(() => {
    if (!activeFilePath || isRecordTabPath(activeFilePath)) return
    const existing = openTabs.find(tab => tab.path === activeFilePath)
    if (existing) {
      if (activeTabId !== existing.id && layoutReady) {
        const activeGroup = layoutRef.current.groups[layoutRef.current.activeGroupId]
        const targetGroup = activeGroup?.tabIds.includes(existing.id)
          ? activeGroup
          : Object.values(layoutRef.current.groups).find(group => group.tabIds.includes(existing.id))
        if (targetGroup) void activateTab(targetGroup.id, existing)
      }
      return
    }
    let disposed = false
    void (async () => {
      const ownedByStandaloneWindow = await focusEditorWindowForPath(activeFilePath).catch(error => {
        console.error('Failed to resolve standalone editor ownership:', error)
        return false
      })
      if (ownedByStandaloneWindow) {
        if (disposed) return
        const currentTab = openTabs.find(tab => tab.id === activeTabId)
        await setActiveFilePath(currentTab?.path ?? '')
        return
      }
      if (disposed) return
      await Promise.resolve(addTab({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        path: activeFilePath,
        name: activeFilePath.split(/[\\/]/).pop() || activeFilePath,
        isFolder: isFolderPath(activeFilePath),
        kind: 'file',
      }))
    })()
    return () => { disposed = true }
  }, [activateTab, activeFilePath, activeTabId, addTab, isFolderPath, layoutReady, openTabs, setActiveFilePath])

  const handleActivateGroup = useCallback((groupId: string, tabId?: string) => {
    const tab = openTabs.find(item => item.id === tabId)
    if (layoutRef.current.activeGroupId === groupId && (!tabId || activeTabId === tabId)) return
    void activateTab(groupId, tab)
  }, [activateTab, activeTabId, openTabs])

  const removeGlobalTabIfUnused = useCallback((nextLayout: EditorWorkspaceLayout, tabId: string) => {
    if (!tabIsReferenced(nextLayout, tabId)) {
      const tab = openTabs.find(item => item.id === tabId)
      if (tab) {
        emitter.emit('editor-file-close', { path: tab.path })
        delete tabContentsRef.current[tab.path]
      }
      void removeTab(tabId)
    }
  }, [openTabs, removeTab])

  const handleCloseTab = useCallback((groupId: string, tabId: string) => {
    const group = layoutRef.current.groups[groupId]
    if (!group) return
    const wasActiveGroup = layoutRef.current.activeGroupId === groupId
    if (group.activeTabId === tabId && layoutRef.current.activeGroupId === groupId && !canDeactivateActiveEditor()) return
    let next = removeTabFromEditorGroup(layoutRef.current, groupId, tabId)
    if (next.groups[groupId]?.tabIds.length === 0 && getEditorGroupIds(next.root).length > 1) {
      next = closeEditorGroup(next, groupId)
    }
    setLayout(next)
    removeGlobalTabIfUnused(next, tabId)
    const nextGroup = next.groups[next.activeGroupId]
    const nextTab = openTabs.find(tab => tab.id === nextGroup?.activeTabId)
    if (wasActiveGroup || activeTabId === tabId) {
      void activateTab(next.activeGroupId, nextTab)
    }
  }, [activateTab, activeTabId, canDeactivateActiveEditor, openTabs, removeGlobalTabIfUnused, setLayout])

  const handleKeepTabs = useCallback((groupId: string, keptTabIds: string[]) => {
    const group = layoutRef.current.groups[groupId]
    if (!group) return
    const removedIds = group.tabIds.filter(id => !keptTabIds.includes(id))
    if (removedIds.includes(group.activeTabId) && layoutRef.current.activeGroupId === groupId && !canDeactivateActiveEditor()) return
    let next = layoutRef.current
    for (const tabId of removedIds) next = removeTabFromEditorGroup(next, groupId, tabId)
    if (!keptTabIds.length && getEditorGroupIds(next.root).length > 1) next = closeEditorGroup(next, groupId)
    setLayout(next)
    removedIds.forEach(tabId => removeGlobalTabIfUnused(next, tabId))
    const nextGroup = next.groups[next.activeGroupId]
    void activateTab(next.activeGroupId, openTabs.find(tab => tab.id === nextGroup?.activeTabId))
  }, [activateTab, canDeactivateActiveEditor, openTabs, removeGlobalTabIfUnused, setLayout])

  const handleCloseGroup = useCallback((groupId: string) => {
    const group = layoutRef.current.groups[groupId]
    if (!group || !canDeactivateActiveEditor()) return
    const next = closeEditorGroup(layoutRef.current, groupId)
    setLayout(next)
    group.tabIds.forEach(tabId => removeGlobalTabIfUnused(next, tabId))
    const activeGroup = next.groups[next.activeGroupId]
    void activateTab(next.activeGroupId, openTabs.find(tab => tab.id === activeGroup?.activeTabId))
  }, [activateTab, canDeactivateActiveEditor, openTabs, removeGlobalTabIfUnused, setLayout])

  const handleSplitTab = useCallback((groupId: string, tabId: string, direction: EditorSplitDirection) => {
    const group = layoutRef.current.groups[groupId]
    if (!group || group.tabIds.length < 2 || !group.tabIds.includes(tabId)) return
    if (!canDeactivateActiveEditor()) return
    const next = splitEditorGroup(layoutRef.current, groupId, direction, tabId, {
      moveFromGroupId: groupId,
    })
    setLayout(next)
    void activateTab(next.activeGroupId, openTabs.find(tab => tab.id === tabId))
  }, [activateTab, canDeactivateActiveEditor, openTabs, setLayout])

  const handleMoveToNewWindow = useCallback(async (_groupId: string, tabId: string) => {
    const tab = openTabs.find(item => item.id === tabId)
    if (!tab) return
    setDetachingTabId(tabId)
    try {
      const currentActivePath = useArticleStore.getState().activeFilePath
      if (currentActivePath && !await prepareActiveEditorDeactivationDurably(currentActivePath)) return
      await useArticleStore.getState().flushPendingArticleSavesForPaths([tab.path])
      const opened = await openEditorWindow(tab)
      if (!opened) {
        toast.error(tGroups('openWindowFailed'))
        return
      }

      let next = layoutRef.current
      for (const currentGroupId of getEditorGroupIds(next.root)) {
        next = removeTabFromEditorGroup(next, currentGroupId, tabId)
      }
      for (const currentGroupId of [...getEditorGroupIds(next.root)]) {
        if (getEditorGroupIds(next.root).length <= 1) break
        if (!next.groups[currentGroupId]?.tabIds.length) {
          next = closeEditorGroup(next, currentGroupId)
        }
      }
      setLayout(next)
      emitter.emit('editor-file-close', { path: tab.path })
      delete tabContentsRef.current[tab.path]
      await setOpenTabs(useArticleStore.getState().openTabs.filter(item => item.id !== tabId))
      const nextGroup = next.groups[next.activeGroupId]
      await activateTab(next.activeGroupId, openTabs.find(item => item.id === nextGroup?.activeTabId))
    } catch (error) {
      console.error('Failed to move editor tab into a standalone window:', error)
      toast.error(tGroups('openWindowFailed'))
    } finally {
      setDetachingTabId('')
    }
  }, [activateTab, openTabs, setLayout, setOpenTabs, tGroups])

  const handleToggleMaximize = useCallback((groupId: string) => {
    suppressPanelLayoutUntilRef.current = Date.now() + 200
    setLayout(current => ({
      ...current,
      maximizedGroupId: current.maximizedGroupId === groupId ? undefined : groupId,
      activeGroupId: groupId,
    }))
  }, [setLayout])

  const handleNewTab = useCallback((groupId: string) => {
    void activateTab(groupId, null)
  }, [activateTab])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragging(false)
    const source = event.active.data.current as { type?: string; groupId?: string; tabId?: string } | undefined
    const target = event.over?.data.current as { type?: string; groupId?: string; tabId?: string; direction?: EditorSplitDirection | 'center' } | undefined
    if (!source?.groupId || !source.tabId) return
    if (!target?.groupId) {
      const rect = event.active.rect.current.translated
      const droppedOutsideWindow = rect
        ? (rect.left + rect.right) / 2 < 0
          || (rect.left + rect.right) / 2 > window.innerWidth
          || (rect.top + rect.bottom) / 2 < 0
          || (rect.top + rect.bottom) / 2 > window.innerHeight
        : false
      if (droppedOutsideWindow) void handleMoveToNewWindow(source.groupId, source.tabId)
      return
    }
    if (!canDeactivateActiveEditor()) return

    let next = layoutRef.current
    if (target.type === 'editor-tab' && target.tabId) {
      const targetGroup = next.groups[target.groupId]
      const targetIndex = targetGroup?.tabIds.indexOf(target.tabId) ?? -1
      next = moveEditorTab(next, source.tabId, source.groupId, target.groupId, targetIndex < 0 ? undefined : targetIndex)
    } else if (target.type === 'editor-tab-list') {
      next = moveEditorTab(next, source.tabId, source.groupId, target.groupId)
    } else if (target.type === 'editor-drop-zone') {
      if (target.direction === 'center') {
        next = moveEditorTab(next, source.tabId, source.groupId, target.groupId)
      } else if (target.direction) {
        next = splitEditorGroup(next, target.groupId, target.direction, source.tabId, {
          moveFromGroupId: source.groupId,
        })
      }
    } else {
      return
    }

    const keepEmptySource = target.type === 'editor-drop-zone'
      && target.direction !== 'center'
      && source.groupId === target.groupId
    const sourceGroup = next.groups[source.groupId]
    if (!keepEmptySource && sourceGroup && !sourceGroup.tabIds.length && getEditorGroupIds(next.root).length > 1) {
      next = closeEditorGroup(next, source.groupId)
    }
    setLayout(next)
    void activateTab(next.activeGroupId, openTabs.find(tab => tab.id === source.tabId))
  }, [activateTab, canDeactivateActiveEditor, handleMoveToNewWindow, openTabs, setLayout])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Tab') {
        const group = layoutRef.current.groups[layoutRef.current.activeGroupId]
        if (!group || group.tabIds.length < 2) return
        const currentIndex = group.tabIds.indexOf(group.activeTabId)
        const offset = event.shiftKey ? -1 : 1
        const nextIndex = (currentIndex + offset + group.tabIds.length) % group.tabIds.length
        event.preventDefault()
        handleActivateGroup(group.id, group.tabIds[nextIndex])
        return
      }
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return
      if (event.key === '\\') {
        const group = layoutRef.current.groups[layoutRef.current.activeGroupId]
        if (!group?.activeTabId) return
        event.preventDefault()
        handleSplitTab(group.id, group.activeTabId, 'right')
        return
      }
      const groupIndex = Number(event.key) - 1
      if (groupIndex < 0 || groupIndex > 8) return
      const groupId = getEditorGroupIds(layoutRef.current.root)[groupIndex]
      const group = layoutRef.current.groups[groupId]
      if (!group) return
      event.preventDefault()
      handleActivateGroup(group.id, group.activeTabId)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleActivateGroup, handleSplitTab])

  const renderContentPanel = useCallback((tab: TabInfo, active: boolean, groupId: string) => {
    if (isRecordEditorTab(tab)) {
      const markId = getRecordIdForTab(tab)
      return <div className="flex min-h-0 flex-1 overflow-hidden">{markId !== null ? <MarkDetailPanel markId={markId} onClose={() => handleCloseTab(groupId, tab.id)} /> : <UnsupportedFile filePath={tab.path} />}</div>
    }
    if (isCanvasEditorTab(tab)) {
      const canvasId = tab.canvasId || getCanvasIdFromTabPath(tab.path)
      return <div className="flex min-h-0 flex-1 overflow-hidden">{canvasId ? <CanvasEditor canvasId={canvasId} isActive={active} /> : <UnsupportedFile filePath={tab.path} />}</div>
    }
    const itemType = getItemType(tab.path)
    return (
      <TabContentErrorBoundary key={tab.id} tabName={tab.name} onClose={() => handleCloseTab(groupId, tab.id)}>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {itemType === 'folder' && <FolderView folderPath={tab.path} />}
          {itemType === 'image' && <ImageEditor filePath={tab.path} isActive={active} />}
          {itemType === 'markdown' && <MdEditor tabContentsRef={tabContentsRef} filePath={tab.path} isActive={active} disabled={detachingTabId === tab.id} />}
          {itemType === 'unknown' && <UnsupportedFile filePath={tab.path} />}
        </div>
      </TabContentErrorBoundary>
    )
  }, [detachingTabId, getItemType, getRecordIdForTab, handleCloseTab, isCanvasEditorTab, isRecordEditorTab])

  const onboardingAgentPrompt = getOnboardingAgentPrompt({
    intro: tOnboarding('agentPrompt.intro'),
    requirements: [1, 2, 3, 4].map(index => tOnboarding(`agentPrompt.requirement${index}`)),
    outro: tOnboarding('agentPrompt.outro'),
  })

  const handleStartOnboardingStep = useCallback(async (step: OnboardingStepId) => {
    if (onboardingProgress.dismissed) {
      const next = { ...onboardingProgress, dismissed: false }
      setOnboardingProgress(next)
      await persistOnboardingProgress(next)
    }
    setCurrentOnboardingTask(step)
    setActiveOnboardingStep(step)
    setCompletedOnboardingStep(null)
    setShowOrganizeNextStepDialog(false)
    if (step === 'create-record') {
      emitter.emit('onboarding-record-prefill-changed', { prefillText: ONBOARDING_SAMPLE_RECORD })
      await setLeftSidebarTab('notes')
      return
    }
    if (step === 'organize-note') {
      await setLeftSidebarTab('notes')
      return
    }
    const candidate = findRecentOnboardingFile({
      preferredPath: onboardingResumeFilePath,
      activeFilePath,
      openTabPaths: openTabs.filter(tab => !isRecordEditorTab(tab)).map(tab => tab.path),
      fileTree,
    })
    if (!rightSidebarVisible) await toggleRightSidebar()
    if (candidate) await setActiveFilePath(candidate)
    await new Promise(resolve => window.setTimeout(resolve, 120))
    setOnboardingPromptDraft(onboardingAgentPrompt)
  }, [activeFilePath, fileTree, isRecordEditorTab, onboardingAgentPrompt, onboardingProgress, onboardingResumeFilePath, openTabs, persistOnboardingProgress, rightSidebarVisible, setActiveFilePath, setLeftSidebarTab, setOnboardingPromptDraft, toggleRightSidebar])

  const handleDismissOnboarding = useCallback(async () => {
    const next = { ...onboardingProgress, dismissed: true }
    setOnboardingProgress(next)
    setCurrentOnboardingTask(null)
    setActiveOnboardingStep(null)
    setCompletedOnboardingStep(null)
    setShowOrganizeNextStepDialog(false)
    await persistOnboardingProgress(next)
  }, [onboardingProgress, persistOnboardingProgress])

  const handleContinueToNextStep = useCallback(() => {
    const step = getActiveOnboardingStep(onboardingProgress)
    setCompletedOnboardingStep(null)
    if (step) void handleStartOnboardingStep(step)
  }, [handleStartOnboardingStep, onboardingProgress])

  const renderEmpty = useCallback((mode: 'new-tab' | 'empty-group') => {
    const isOnlyGroup = getEditorGroupIds(layout.root).length === 1
    if (mode === 'empty-group' && !isOnlyGroup) {
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{tGroups('emptyGroup')}</div>
    }
    return (
      <EmptyState
        onboardingProgress={onboardingProgress}
        activeOnboardingStep={currentOnboardingTask}
        visibleOnboardingStep={activeOnboardingStep}
        completedOnboardingStep={completedOnboardingStep}
        onStartOnboardingStep={handleStartOnboardingStep}
        onContinueToNextStep={handleContinueToNextStep}
        onDismissOnboarding={handleDismissOnboarding}
      />
    )
  }, [activeOnboardingStep, completedOnboardingStep, currentOnboardingTask, handleContinueToNextStep, handleDismissOnboarding, handleStartOnboardingStep, layout.root, onboardingProgress, tGroups])

  const renderLayoutNode = useCallback((node: EditorLayoutNode): React.ReactNode => {
    if (node.type === 'group') {
      const group = layout.groups[node.groupId]
      if (!group) return null
      return (
        <EditorGroupPane
          key={node.id}
          group={group}
          tabs={openTabs}
          activeLayout={layout}
          dragging={dragging}
          onActivateGroup={handleActivateGroup}
          onNewTab={handleNewTab}
          onCloseTab={handleCloseTab}
          onKeepTabs={handleKeepTabs}
          onSplitTab={handleSplitTab}
          onMoveToNewWindow={handleMoveToNewWindow}
          onToggleMaximize={handleToggleMaximize}
          onCloseGroup={handleCloseGroup}
          renderActiveContent={renderContentPanel}
          renderEmpty={renderEmpty}
        />
      )
    }
    return (
      <ResizablePanelGroup
        key={node.id}
        orientation={node.orientation}
        onLayoutChanged={(nextLayout: Layout) => {
          if (layout.maximizedGroupId || Date.now() < suppressPanelLayoutUntilRef.current) return
          const sizes = node.children.map(child => nextLayout[child.id] ?? 0)
          setLayout(current => updateEditorSplitSizes(current, node.id, sizes))
        }}
      >
        {node.children.map((child, index) => {
          const visible = !layout.maximizedGroupId
            || getEditorGroupIds(child).includes(layout.maximizedGroupId)
          return (
            <Fragment key={child.id}>
              {index > 0 && <ResizableHandle className={layout.maximizedGroupId ? 'hidden' : undefined} />}
              <ResizablePanel
                id={child.id}
                defaultSize={`${node.sizes[index] ?? 100 / node.children.length}%`}
                style={visible
                  ? layout.maximizedGroupId ? { flex: '1 1 100%' } : undefined
                  : { display: 'none' }}
              >
                {renderLayoutNode(child)}
              </ResizablePanel>
            </Fragment>
          )
        })}
      </ResizablePanelGroup>
    )
  }, [dragging, handleActivateGroup, handleCloseGroup, handleCloseTab, handleKeepTabs, handleMoveToNewWindow, handleNewTab, handleSplitTab, handleToggleMaximize, layout, openTabs, renderContentPanel, renderEmpty, setLayout])

  if (!layoutReady) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tGroups('loadingLayout')}</div>
  const spotlightTitle = activeOnboardingStep ? tOnboarding(`spotlight.${activeOnboardingStep}.title`) : ''
  const spotlightDescription = activeOnboardingStep ? tOnboarding(`spotlight.${activeOnboardingStep}.desc`) : ''

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={editorCollisionDetection}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={handleDragEnd}
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {renderLayoutNode(layout.root)}
      </div>
      <OnboardingSpotlight
        targetId={activeOnboardingStep ? getOnboardingSpotlightTarget(activeOnboardingStep) : null}
        title={spotlightTitle}
        description={spotlightDescription}
        onDismiss={() => setActiveOnboardingStep(null)}
      />
      <Dialog open={showOrganizeNextStepDialog} onOpenChange={setShowOrganizeNextStepDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tOnboarding('afterOrganizeDialog.title')}</DialogTitle>
            <DialogDescription>{tOnboarding('afterOrganizeDialog.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrganizeNextStepDialog(false)}>{tOnboarding('afterOrganizeDialog.cancel')}</Button>
            <Button onClick={() => {
              setShowOrganizeNextStepDialog(false)
              setCompletedOnboardingStep('organize-note')
              void activateTab(layout.activeGroupId, null)
            }}>{tOnboarding('afterOrganizeDialog.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
