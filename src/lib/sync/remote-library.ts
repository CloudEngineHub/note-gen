import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { Store } from '@tauri-apps/plugin-store'
import { getFiles as getGithubFiles, uploadFile as uploadGithubFile } from './github'
import { getFiles as getGiteeFiles, uploadFile as uploadGiteeFile } from './gitee'
import { getFiles as getGitlabFiles, uploadFile as uploadGitlabFile } from './gitlab'
import { getFiles as getGiteaFiles, uploadFile as uploadGiteaFile } from './gitea'
import { s3ListObjects, s3Upload } from './s3'
import { webdavListObjects, webdavUpload } from './webdav'
import { pullRemoteFile, saveLocalFile } from './auto-sync'
import { getSyncRepoName } from './repo-utils'
import { getFilePathOptions } from '@/lib/workspace'
import { collectMarkdownFiles } from '@/lib/files'
import type { S3Config, SyncPlatform, WebDAVConfig } from '@/types/sync'

const ARTICLE_FILE_PATTERN = /\.(md|txt|markdown|py|js|ts|jsx|tsx|css|scss|less|html|xml|json|yaml|yml|sh|bash|java|c|cpp|h|go|rs|sql|rb|php|vue|svelte|astro|toml|ini|conf|cfg|gitignore|env|example|template|jpg|jpeg|png|gif|bmp|webp|svg)$/i

type GitRemoteEntry = {
  name?: string
  path?: string
  type?: string
  sha?: string
  size?: number
}

export type RemoteLibraryFile = {
  path: string
  sha: string
  size?: number
  modifiedAt?: string
}

export type PullAllProgress = {
  phase: 'listing' | 'downloading' | 'uploading' | 'uploaded' | 'completed'
  current: number
  total: number
  path?: string
  sha?: string
}

export type PullAllResult = {
  total: number
  downloaded: number
  skipped: number
  failed: Array<{ path: string; message: string }>
}

export type UploadAllResult = {
  total: number
  uploaded: number
  failed: Array<{ path: string; message: string }>
}

async function getPlatform(store: Store): Promise<SyncPlatform> {
  return await store.get<SyncPlatform>('primaryBackupMethod') || 'github'
}

function isArticlePath(path: string): boolean {
  if (!path || path.startsWith('.') || path.split('/').some(part => part.startsWith('.'))) {
    return false
  }
  return ARTICLE_FILE_PATTERN.test(path)
}

function normalizeGitEntries(value: unknown): GitRemoteEntry[] {
  return Array.isArray(value) ? value as GitRemoteEntry[] : []
}

async function listGitRemoteFiles(platform: Exclude<SyncPlatform, 's3' | 'webdav'>): Promise<RemoteLibraryFile[]> {
  const repo = await getSyncRepoName(platform)
  const queue = ['']
  const visited = new Set<string>()
  const files: RemoteLibraryFile[] = []

  while (queue.length > 0) {
    const path = queue.shift() || ''
    if (visited.has(path)) continue
    visited.add(path)

    let result: unknown
    switch (platform) {
      case 'github':
        result = await getGithubFiles({ path, repo })
        break
      case 'gitee':
        result = await getGiteeFiles({ path, repo })
        break
      case 'gitlab':
        result = await getGitlabFiles({ path, repo })
        break
      case 'gitea':
        result = await getGiteaFiles({ path, repo })
        break
    }

    for (const entry of normalizeGitEntries(result)) {
      const entryPath = entry.path || (path ? `${path}/${entry.name || ''}` : entry.name || '')
      if (!entryPath || entryPath.split('/').some(part => part.startsWith('.'))) continue

      if (entry.type === 'dir' || entry.type === 'tree') {
        queue.push(entryPath)
        continue
      }

      if (isArticlePath(entryPath)) {
        files.push({
          path: entryPath,
          sha: entry.sha || '',
          size: entry.size,
        })
      }
    }
  }

  return files
}

async function listObjectStorageFiles(store: Store, platform: 's3' | 'webdav'): Promise<RemoteLibraryFile[]> {
  if (platform === 's3') {
    const config = await store.get<S3Config>('s3SyncConfig')
    if (!config) throw new Error('S3 未配置')
    const objects = await s3ListObjects(config, '')
    return objects
      .filter(object => isArticlePath(object.key))
      .map(object => ({
        path: object.key,
        sha: object.etag,
        size: object.size,
        modifiedAt: object.lastModified,
      }))
  }

  const config = await store.get<WebDAVConfig>('webdavSyncConfig')
  if (!config) throw new Error('WebDAV 未配置')
  const queue = ['']
  const visited = new Set<string>()
  const files: RemoteLibraryFile[] = []

  while (queue.length > 0) {
    const path = queue.shift() || ''
    if (visited.has(path)) continue
    visited.add(path)
    const objects = await webdavListObjects(config, path)

    for (const object of objects) {
      const relativeObjectPath = object.key.replace(/^\/+/, '')
      const objectPath = path
        ? `${path}/${relativeObjectPath}`.replace(/\/$/, '')
        : relativeObjectPath.replace(/\/$/, '')

      if (object.key.endsWith('/')) {
        queue.push(objectPath)
      } else if (isArticlePath(objectPath)) {
        files.push({
          path: objectPath,
          sha: object.etag,
          size: object.size,
          modifiedAt: object.lastModified,
        })
      }
    }
  }

  return files
}

export async function listRemoteLibraryFiles(): Promise<RemoteLibraryFile[]> {
  const store = await Store.load('store.json')
  const platform = await getPlatform(store)
  const files = platform === 's3' || platform === 'webdav'
    ? await listObjectStorageFiles(store, platform)
    : await listGitRemoteFiles(platform)

  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export async function isLocalLibraryFile(path: string): Promise<boolean> {
  const pathOptions = await getFilePathOptions(path)
  return pathOptions.baseDir
    ? await exists(pathOptions.path, { baseDir: pathOptions.baseDir })
    : await exists(pathOptions.path)
}

export async function pullAllRemoteLibraryFiles(
  onProgress?: (progress: PullAllProgress) => void
): Promise<PullAllResult> {
  onProgress?.({ phase: 'listing', current: 0, total: 0 })
  const files = await listRemoteLibraryFiles()
  const result: PullAllResult = { total: files.length, downloaded: 0, skipped: 0, failed: [] }

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    onProgress?.({ phase: 'downloading', current: index + 1, total: files.length, path: file.path })

    try {
      if (await isLocalLibraryFile(file.path)) {
        result.skipped += 1
        continue
      }

      const content = await pullRemoteFile(file.path)
      await saveLocalFile(file.path, content)
      result.downloaded += 1
    } catch (error) {
      result.failed.push({
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onProgress?.({ phase: 'completed', current: files.length, total: files.length })
  return result
}

export async function uploadAllLocalLibraryFiles(
  onProgress?: (progress: PullAllProgress) => void
): Promise<UploadAllResult> {
  onProgress?.({ phase: 'listing', current: 0, total: 0 })
  const files = await collectMarkdownFiles('')
  const result: UploadAllResult = { total: files.length, uploaded: 0, failed: [] }

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    onProgress?.({ phase: 'uploading', current: index + 1, total: files.length, path: file.path })

    try {
      const pathOptions = await getFilePathOptions(file.path)
      const content = pathOptions.baseDir
        ? await readTextFile(pathOptions.path, { baseDir: pathOptions.baseDir })
        : await readTextFile(pathOptions.path)
      const sha = await uploadRemoteText(file.path, content, `Upload note: ${file.path}`)
      result.uploaded += 1
      onProgress?.({
        phase: 'uploaded',
        current: index + 1,
        total: files.length,
        path: file.path,
        sha,
      })
    } catch (error) {
      result.failed.push({
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onProgress?.({ phase: 'completed', current: files.length, total: files.length })
  return result
}

async function getExistingRemoteSha(platform: Exclude<SyncPlatform, 's3' | 'webdav'>, path: string, repo: string) {
  let entry: unknown
  switch (platform) {
    case 'github':
      entry = await getGithubFiles({ path, repo })
      break
    case 'gitee':
      entry = await getGiteeFiles({ path, repo })
      break
    case 'gitlab':
      entry = await getGitlabFiles({ path, repo })
      break
    case 'gitea':
      entry = await getGiteaFiles({ path, repo })
      break
  }

  return entry && !Array.isArray(entry) && typeof entry === 'object'
    ? (entry as { sha?: string }).sha
    : undefined
}

function getUploadedRemoteVersion(response: unknown): string {
  if (!response || typeof response !== 'object') return ''

  const responseRecord = response as Record<string, unknown>
  const wrappedData = 'data' in responseRecord ? responseRecord.data : responseRecord
  if (!wrappedData || typeof wrappedData !== 'object') return ''

  const dataRecord = wrappedData as Record<string, unknown>
  const contentData = dataRecord.content
  if (contentData && typeof contentData === 'object') {
    const contentSha = (contentData as Record<string, unknown>).sha
    if (typeof contentSha === 'string') return contentSha
  }

  for (const key of ['sha', 'id', 'commit_id'] as const) {
    const value = dataRecord[key]
    if (typeof value === 'string') return value
  }

  return ''
}

export async function uploadRemoteText(path: string, content: string, message: string): Promise<string> {
  const store = await Store.load('store.json')
  const platform = await getPlatform(store)

  if (platform === 's3') {
    const config = await store.get<S3Config>('s3SyncConfig')
    const result = config ? await s3Upload(config, path, content) : null
    if (!result) throw new Error('S3 上传失败')
    return result.etag || `uploaded:${path}`
  }

  if (platform === 'webdav') {
    const config = await store.get<WebDAVConfig>('webdavSyncConfig')
    const result = config ? await webdavUpload(config, path, content) : null
    if (!result) throw new Error('WebDAV 上传失败')
    return result.etag || `uploaded:${path}`
  }

  const repo = await getSyncRepoName(platform)
  const sha = await getExistingRemoteSha(platform, path, repo)
  const filename = path.split('/').pop() || path
  let response: unknown

  switch (platform) {
    case 'github':
      response = await uploadGithubFile({ file: content, filename, path, repo, sha, message })
      break
    case 'gitee':
      response = await uploadGiteeFile({ file: content, filename, path, repo, sha, message })
      break
    case 'gitlab':
      response = await uploadGitlabFile({ file: content, filename, path, repo, sha, message })
      break
    case 'gitea':
      response = await uploadGiteaFile({ file: content, filename, path, repo, sha, message })
      break
  }

  if (!response) throw new Error(`${platform} 上传失败`)
  return getUploadedRemoteVersion(response) || sha || `uploaded:${path}`
}

export async function downloadRemoteText(path: string): Promise<string> {
  return await pullRemoteFile(path)
}
