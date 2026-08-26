import type { OpenTabInfo } from '@/stores/article'

export type EditorSplitDirection = 'left' | 'right' | 'up' | 'down'
export type EditorSplitOrientation = 'horizontal' | 'vertical'

export interface EditorGroup {
  id: string
  tabIds: string[]
  activeTabId: string
  locked?: boolean
}

export interface EditorGroupNode {
  type: 'group'
  id: string
  groupId: string
}

export interface EditorSplitNode {
  type: 'split'
  id: string
  orientation: EditorSplitOrientation
  children: EditorLayoutNode[]
  sizes: number[]
}

export type EditorLayoutNode = EditorGroupNode | EditorSplitNode

export interface EditorWorkspaceLayout {
  version: 1
  root: EditorLayoutNode
  groups: Record<string, EditorGroup>
  activeGroupId: string
  maximizedGroupId?: string
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createEditorGroup(tabIds: string[] = []): EditorGroup {
  return {
    id: createId('editor-group'),
    tabIds,
    activeTabId: tabIds.at(-1) ?? '',
  }
}

export function createEditorWorkspaceLayout(tabs: OpenTabInfo[]): EditorWorkspaceLayout {
  const group = createEditorGroup(tabs.map(tab => tab.id))
  return {
    version: 1,
    root: { type: 'group', id: createId('editor-node'), groupId: group.id },
    groups: { [group.id]: group },
    activeGroupId: group.id,
  }
}

export function getEditorGroupIds(node: EditorLayoutNode): string[] {
  if (node.type === 'group') return [node.groupId]
  return node.children.flatMap(getEditorGroupIds)
}

export function findEditorGroupForTab(
  layout: EditorWorkspaceLayout,
  tabId: string,
): EditorGroup | undefined {
  return Object.values(layout.groups).find(group => group.tabIds.includes(tabId))
}

function replaceLayoutNode(
  node: EditorLayoutNode,
  targetGroupId: string,
  replacement: EditorLayoutNode,
): EditorLayoutNode {
  if (node.type === 'group') {
    return node.groupId === targetGroupId ? replacement : node
  }
  return {
    ...node,
    children: node.children.map(child => replaceLayoutNode(child, targetGroupId, replacement)),
  }
}

function findEditorGroupNode(
  node: EditorLayoutNode,
  groupId: string,
): EditorGroupNode | undefined {
  if (node.type === 'group') return node.groupId === groupId ? node : undefined
  for (const child of node.children) {
    const match = findEditorGroupNode(child, groupId)
    if (match) return match
  }
  return undefined
}

function removeGroupNode(
  node: EditorLayoutNode,
  groupId: string,
): EditorLayoutNode | null {
  if (node.type === 'group') return node.groupId === groupId ? null : node

  const children = node.children
    .map(child => removeGroupNode(child, groupId))
    .filter((child): child is EditorLayoutNode => child !== null)

  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return {
    ...node,
    children,
    sizes: children.map(() => 100 / children.length),
  }
}

export function updateEditorSplitSizes(
  layout: EditorWorkspaceLayout,
  splitId: string,
  sizes: number[],
): EditorWorkspaceLayout {
  const update = (node: EditorLayoutNode): EditorLayoutNode => {
    if (node.type === 'group') return node
    if (node.id === splitId) {
      const unchanged = node.sizes.length === sizes.length
        && node.sizes.every((size, index) => Math.abs(size - sizes[index]) < 0.01)
      return unchanged ? node : { ...node, sizes }
    }
    const children = node.children.map(update)
    return children.every((child, index) => child === node.children[index])
      ? node
      : { ...node, children }
  }
  const root = update(layout.root)
  return root === layout.root ? layout : { ...layout, root }
}

export function splitEditorGroup(
  layout: EditorWorkspaceLayout,
  targetGroupId: string,
  direction: EditorSplitDirection,
  tabId: string,
  options: { moveFromGroupId?: string } = {},
): EditorWorkspaceLayout {
  const targetGroup = layout.groups[targetGroupId]
  if (!targetGroup || !tabId) return layout
  if (options.moveFromGroupId === targetGroupId && targetGroup.tabIds.length < 2) return layout

  const nextGroups = { ...layout.groups }
  if (options.moveFromGroupId) {
    const sourceGroup = nextGroups[options.moveFromGroupId]
    if (sourceGroup) {
      const nextTabIds = sourceGroup.tabIds.filter(id => id !== tabId)
      nextGroups[sourceGroup.id] = {
        ...sourceGroup,
        tabIds: nextTabIds,
        activeTabId: sourceGroup.activeTabId === tabId
          ? nextTabIds.at(-1) ?? ''
          : sourceGroup.activeTabId,
      }
    }
  }

  const newGroup = createEditorGroup([tabId])
  nextGroups[newGroup.id] = newGroup
  const existingNode = findEditorGroupNode(layout.root, targetGroupId)
  if (!existingNode) return layout
  const newNode: EditorGroupNode = {
    type: 'group',
    id: createId('editor-node'),
    groupId: newGroup.id,
  }
  const newFirst = direction === 'left' || direction === 'up'
  const replacement: EditorSplitNode = {
    type: 'split',
    id: createId('editor-split'),
    orientation: direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical',
    children: newFirst ? [newNode, existingNode] : [existingNode, newNode],
    sizes: [50, 50],
  }

  return {
    ...layout,
    root: replaceLayoutNode(layout.root, targetGroupId, replacement),
    groups: nextGroups,
    activeGroupId: newGroup.id,
    maximizedGroupId: undefined,
  }
}

export function moveEditorTab(
  layout: EditorWorkspaceLayout,
  tabId: string,
  sourceGroupId: string,
  targetGroupId: string,
  targetIndex?: number,
  copy = false,
): EditorWorkspaceLayout {
  const source = layout.groups[sourceGroupId]
  const target = layout.groups[targetGroupId]
  if (!source || !target || !source.tabIds.includes(tabId)) return layout

  let nextSourceIds = [...source.tabIds]
  const nextTargetIds = target.tabIds.filter(id => id !== tabId)
  if (!copy) nextSourceIds = nextSourceIds.filter(id => id !== tabId)

  const insertionIndex = Math.max(0, Math.min(targetIndex ?? nextTargetIds.length, nextTargetIds.length))
  nextTargetIds.splice(insertionIndex, 0, tabId)
  const groups = {
    ...layout.groups,
    [sourceGroupId]: {
      ...source,
      tabIds: nextSourceIds,
      activeTabId: source.activeTabId === tabId && !copy
        ? nextSourceIds.at(-1) ?? ''
        : source.activeTabId,
    },
    [targetGroupId]: {
      ...target,
      tabIds: nextTargetIds,
      activeTabId: tabId,
    },
  }

  return {
    ...layout,
    groups,
    activeGroupId: targetGroupId,
  }
}

export function setActiveEditorGroupTab(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
): EditorWorkspaceLayout {
  const group = layout.groups[groupId]
  if (!group || (tabId && !group.tabIds.includes(tabId))) return layout
  return {
    ...layout,
    activeGroupId: groupId,
    groups: {
      ...layout.groups,
      [groupId]: { ...group, activeTabId: tabId },
    },
  }
}

export function removeTabFromEditorGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
  tabId: string,
): EditorWorkspaceLayout {
  const group = layout.groups[groupId]
  if (!group) return layout
  const tabIndex = group.tabIds.indexOf(tabId)
  if (tabIndex < 0) return layout
  const tabIds = group.tabIds.filter(id => id !== tabId)
  const activeTabId = group.activeTabId === tabId
    ? tabIds[Math.max(0, tabIndex - 1)] ?? tabIds.at(-1) ?? ''
    : group.activeTabId
  const groups = {
    ...layout.groups,
    [groupId]: { ...group, tabIds, activeTabId },
  }
  return { ...layout, groups }
}

export function closeEditorGroup(
  layout: EditorWorkspaceLayout,
  groupId: string,
): EditorWorkspaceLayout {
  const groupIds = getEditorGroupIds(layout.root)
  if (!layout.groups[groupId] || groupIds.length === 1) {
    const group = layout.groups[groupId]
    return group
      ? {
          ...layout,
          groups: { ...layout.groups, [groupId]: { ...group, tabIds: [], activeTabId: '' } },
          maximizedGroupId: undefined,
        }
      : layout
  }

  const root = removeGroupNode(layout.root, groupId)
  if (!root) return layout
  const groups = { ...layout.groups }
  delete groups[groupId]
  const remainingIds = getEditorGroupIds(root)
  const activeGroupId = layout.activeGroupId === groupId
    ? remainingIds.at(-1) ?? remainingIds[0]
    : layout.activeGroupId
  return {
    ...layout,
    root,
    groups,
    activeGroupId,
    maximizedGroupId: undefined,
  }
}

export function normalizeEditorWorkspaceLayout(
  value: EditorWorkspaceLayout | null | undefined,
  tabs: OpenTabInfo[],
): EditorWorkspaceLayout {
  if (!value || value.version !== 1 || !value.root || !value.groups) {
    return createEditorWorkspaceLayout(tabs)
  }

  const validTabIds = new Set(tabs.map(tab => tab.id))
  const nodeGroupIds = getEditorGroupIds(value.root)
  if (nodeGroupIds.length === 0) return createEditorWorkspaceLayout(tabs)

  const groups: Record<string, EditorGroup> = {}
  const assigned = new Set<string>()
  for (const groupId of nodeGroupIds) {
    const group = value.groups[groupId]
    if (!group) return createEditorWorkspaceLayout(tabs)
    const tabIds = group.tabIds.filter(id => {
      if (!validTabIds.has(id) || assigned.has(id)) return false
      assigned.add(id)
      return true
    })
    groups[groupId] = {
      ...group,
      tabIds,
      activeTabId: tabIds.includes(group.activeTabId)
        ? group.activeTabId
        : tabIds.at(-1) ?? '',
    }
  }

  const unassigned = tabs.map(tab => tab.id).filter(id => !assigned.has(id))
  const activeGroupId = groups[value.activeGroupId]
    ? value.activeGroupId
    : nodeGroupIds[0]
  if (unassigned.length > 0) {
    const target = groups[activeGroupId]
    groups[activeGroupId] = {
      ...target,
      tabIds: [...target.tabIds, ...unassigned],
      activeTabId: unassigned.at(-1) ?? target.activeTabId,
    }
  }

  let normalized: EditorWorkspaceLayout = {
    ...value,
    groups,
    activeGroupId,
    maximizedGroupId: value.maximizedGroupId && groups[value.maximizedGroupId]
      ? value.maximizedGroupId
      : undefined,
  }

  for (const groupId of nodeGroupIds) {
    if (getEditorGroupIds(normalized.root).length === 1) break
    if (normalized.groups[groupId]?.tabIds.length === 0) {
      normalized = closeEditorGroup(normalized, groupId)
    }
  }

  return normalized
}

export function tabIsReferenced(
  layout: EditorWorkspaceLayout,
  tabId: string,
  excludingGroupId?: string,
) {
  return Object.values(layout.groups).some(group => (
    group.id !== excludingGroupId && group.tabIds.includes(tabId)
  ))
}
