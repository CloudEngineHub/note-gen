import emitter from '@/lib/emitter'

type ActiveEditorDurableSaveFlusher = (path: string) => Promise<void>
type EditorPathMutationFlusher = (changedPaths: string[]) => Promise<void>
export type EditorPathWriteTransactionContext = {
  hasQueuedSave: () => boolean
}
type EditorPathWriteTransactionRunner = (
  path: string,
  transaction: (context: EditorPathWriteTransactionContext) => Promise<boolean>,
) => Promise<boolean>

let activeEditorDurableSaveFlusher: ActiveEditorDurableSaveFlusher | null = null
let editorPathMutationFlusher: EditorPathMutationFlusher | null = null
let editorPathWriteTransactionRunner: EditorPathWriteTransactionRunner | null = null
const editorPathMutationRevisions = new Map<string, number>()

function getEditorPathRevisionKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/').trim()
}

export function markEditorPathMutation(path: string): void {
  const key = getEditorPathRevisionKey(path)
  if (!key) return
  editorPathMutationRevisions.set(key, (editorPathMutationRevisions.get(key) ?? 0) + 1)
}

export function getEditorPathMutationRevision(path: string): number {
  const key = getEditorPathRevisionKey(path)
  return key ? editorPathMutationRevisions.get(key) ?? 0 : 0
}

export function registerActiveEditorDurableSaveFlusher(
  flusher: ActiveEditorDurableSaveFlusher,
): void {
  activeEditorDurableSaveFlusher = flusher
}

export function registerEditorPathMutationFlusher(
  flusher: EditorPathMutationFlusher,
): void {
  editorPathMutationFlusher = flusher
}

export function registerEditorPathWriteTransactionRunner(
  runner: EditorPathWriteTransactionRunner,
): void {
  editorPathWriteTransactionRunner = runner
}

export async function runEditorPathWriteTransaction(
  path: string,
  transaction: (context: EditorPathWriteTransactionContext) => Promise<boolean>,
): Promise<boolean> {
  if (!editorPathWriteTransactionRunner) {
    throw new Error('The article path write transaction runner is not registered')
  }
  return editorPathWriteTransactionRunner(path, transaction)
}

/**
 * Gives the active editor a synchronous chance to flush stable content or
 * reject an action that would unmount it while an asynchronous edit is active.
 */
export function prepareActiveEditorDeactivation(): boolean {
  let canDeactivate = true
  emitter.emit('editor-prepare-deactivate', {
    resolve: (nextValue) => {
      canDeactivate = canDeactivate && nextValue
    },
  })
  return canDeactivate
}

export function activeEditorPathIsAffected(
  activeFilePath: string,
  changedPath: string,
): boolean {
  const normalizedPath = changedPath.replace(/\/+$/, '')
  return Boolean(
    activeFilePath
    && normalizedPath
    && (
      activeFilePath === normalizedPath
      || activeFilePath.startsWith(`${normalizedPath}/`)
    )
  )
}

export function prepareActiveEditorPathMutation(
  activeFilePath: string,
  changedPaths: string[],
): boolean {
  if (!changedPaths.some(path => activeEditorPathIsAffected(activeFilePath, path))) {
    return true
  }
  return prepareActiveEditorDeactivation()
}

async function flushActiveEditorSave(path: string): Promise<boolean> {
  if (!path || !activeEditorDurableSaveFlusher) return true

  try {
    await activeEditorDurableSaveFlusher(path)
    return true
  } catch (error) {
    console.error('Failed to durably flush the active editor before changing files:', error)
    return false
  }
}

export async function prepareActiveEditorDeactivationDurably(
  activeFilePath: string,
): Promise<boolean> {
  if (!prepareActiveEditorDeactivation()) return false
  return flushActiveEditorSave(activeFilePath)
}

export async function prepareActiveEditorPathMutationDurably(
  activeFilePath: string,
  changedPaths: string[],
): Promise<boolean> {
  const activeEditorIsAffected = changedPaths.some(
    path => activeEditorPathIsAffected(activeFilePath, path)
  )
  if (
    activeEditorIsAffected
    && !await prepareActiveEditorDeactivationDurably(activeFilePath)
  ) {
    return false
  }

  if (!editorPathMutationFlusher) return true
  try {
    await editorPathMutationFlusher(changedPaths)
    return true
  } catch (error) {
    console.error('Failed to durably flush pending saves before mutating file paths:', error)
    return false
  }
}
