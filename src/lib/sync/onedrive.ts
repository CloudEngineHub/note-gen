import { invoke } from '@tauri-apps/api/core'
import { fetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { platform } from '@tauri-apps/plugin-os'
import { Store } from '@tauri-apps/plugin-store'

import type { CloudFolderObject } from './cloud-folder'
import { clearCloudFolderTreeCache } from './cloud-folder-tree-cache'
import type { CloudFolderConfig } from '@/types/sync'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const AUTHORITY_BASE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const ONE_DRIVE_SCOPE = 'offline_access Files.ReadWrite.AppFolder'
const ONE_DRIVE_TOKEN_KEY = 'oneDriveAuthTokens'
const SIMPLE_UPLOAD_LIMIT = 10 * 1024 * 1024
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_TRANSIENT_RETRIES = 4
const FOLDER_CACHE_TTL = 5 * 60 * 1000
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const folderCache = new Map<string, { item: OneDriveDriveItem; cachedAt: number }>()

export const ONE_DRIVE_APP_ROOT_PATH = 'onedrive://approot'
export const ONE_DRIVE_APP_ROOT_LABEL = 'OneDrive / Apps / NoteGen'
export const ONE_DRIVE_CLIENT_ID = (
  process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '212aa08f-dd2e-417d-ae34-adae14af9b61'
).trim()

interface OneDriveAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
}

interface OneDriveTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

interface OneDriveDeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
  message?: string
}

interface OneDriveOAuthError {
  error?: string
  error_description?: string
}

interface NativeOAuthResponse {
  status: number
  body: string
  retryAfter?: string
}

interface OneDriveGraphError {
  error?: {
    code?: string
    message?: string
  }
}

interface OneDriveDriveItem {
  id: string
  name: string
  size?: number
  eTag?: string
  cTag?: string
  lastModifiedDateTime?: string
  webUrl?: string
  '@microsoft.graph.downloadUrl'?: string
  parentReference?: {
    driveId?: string
  }
  folder?: {
    childCount?: number
  }
  file?: {
    mimeType?: string
  }
  deleted?: Record<string, never>
}

interface OneDriveChildrenResponse {
  value: OneDriveDriveItem[]
  '@odata.nextLink'?: string
}

interface OneDriveUploadSession {
  uploadUrl: string
  expirationDateTime?: string
}

function parseStoredTokens(value: string): OneDriveAuthTokens | null {
  try {
    const parsed = JSON.parse(value) as Partial<OneDriveAuthTokens>
    if (
      typeof parsed.accessToken !== 'string'
      || typeof parsed.refreshToken !== 'string'
      || typeof parsed.expiresAt !== 'number'
      || typeof parsed.scope !== 'string'
    ) return null
    return parsed as OneDriveAuthTokens
  } catch {
    return null
  }
}

export interface OneDriveLoginCode {
  userCode: string
  verificationUrl: string
  message: string
  expiresAt: number
  copied?: boolean
}

function waitForNextPoll(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('OneDrive sign-in cancelled', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('retry-after')?.trim()
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(0, seconds * 1000))
    const timestamp = Date.parse(retryAfter)
    if (Number.isFinite(timestamp)) return Math.min(60_000, Math.max(0, timestamp - Date.now()))
  }
  const exponential = Math.min(30_000, 1000 * (2 ** attempt))
  return exponential + Math.floor(Math.random() * 500)
}

async function fetchWithTransientRetry(request: () => Promise<Response>): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    let response: Response | null = null
    try {
      response = await request()
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_TRANSIENT_RETRIES) {
        return response
      }
    } catch (error) {
      lastError = error
      if (attempt === MAX_TRANSIENT_RETRIES) throw error
    }
    await waitForNextPoll(retryDelayMs(response, attempt))
  }
  throw lastError instanceof Error ? lastError : new Error('OneDrive request failed')
}

function configuredClientId(config: CloudFolderConfig): string {
  return (config.oneDriveClientId || ONE_DRIVE_CLIENT_ID).trim()
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function normalizeKey(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const segments = normalized.split('/').filter(Boolean)
  if (!segments.length || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('Invalid OneDrive path')
  }
  return segments.join('/')
}

function itemEtag(item: OneDriveDriveItem): string {
  return item.eTag || item.cTag || item.id
}

function folderCacheKey(config: CloudFolderConfig, path: string): string {
  return `${configuredClientId(config)}\0${config.oneDriveRootId || ONE_DRIVE_APP_ROOT_PATH}\0${path}`
}

function getCachedFolder(config: CloudFolderConfig, path: string): OneDriveDriveItem | null {
  const key = folderCacheKey(config, path)
  const cached = folderCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.cachedAt > FOLDER_CACHE_TTL) {
    folderCache.delete(key)
    return null
  }
  return cached.item
}

function cacheFolder(config: CloudFolderConfig, path: string, item: OneDriveDriveItem): void {
  folderCache.set(folderCacheKey(config, path), { item, cachedAt: Date.now() })
}

function toCloudFolderObject(key: string, item: OneDriveDriveItem): CloudFolderObject {
  return {
    key,
    size: item.size || 0,
    modifiedAt: item.lastModifiedDateTime ? Date.parse(item.lastModifiedDateTime) : 0,
    etag: itemEtag(item),
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

async function oauthRequest<T>(path: string, body: URLSearchParams): Promise<{ response: Response; data: T }> {
  const response = await fetchWithTransientRetry(async () => {
    if (platform() === 'android') {
      const result = await invoke<NativeOAuthResponse>('microsoft_oauth_request', {
        path,
        form: Object.fromEntries(body.entries()),
      })
      return new Response(result.body, {
        status: result.status,
        headers: result.retryAfter ? { 'retry-after': result.retryAfter } : undefined,
      })
    }
    return fetch(`${AUTHORITY_BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  })
  return { response, data: await parseJson<T>(response) }
}

async function saveTokens(response: OneDriveTokenResponse, fallbackRefreshToken = ''): Promise<void> {
  const refreshToken = response.refresh_token || fallbackRefreshToken
  if (!refreshToken) throw new Error('Microsoft did not return a refresh token')
  const tokens = {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + Math.max(0, response.expires_in - 60) * 1000,
    scope: response.scope || ONE_DRIVE_SCOPE,
  } satisfies OneDriveAuthTokens
  const store = await Store.load('store.json')
  if (platform() === 'android') {
    await invoke('set_android_secure_value', {
      key: ONE_DRIVE_TOKEN_KEY,
      value: JSON.stringify(tokens),
    })
    await store.delete(ONE_DRIVE_TOKEN_KEY)
  } else {
    await store.set(ONE_DRIVE_TOKEN_KEY, tokens)
  }
  await store.save()
}

async function getStoredTokens(): Promise<OneDriveAuthTokens | null> {
  const store = await Store.load('store.json')
  const legacyTokens = await store.get<OneDriveAuthTokens>(ONE_DRIVE_TOKEN_KEY) ?? null
  if (platform() !== 'android') return legacyTokens

  try {
    const value = await invoke<string | null>('get_android_secure_value', { key: ONE_DRIVE_TOKEN_KEY })
    if (value) {
      const tokens = parseStoredTokens(value)
      if (tokens) return tokens
      await invoke('delete_android_secure_value', { key: ONE_DRIVE_TOKEN_KEY })
    }
  } catch (error) {
    console.warn('Failed to read OneDrive tokens from Android secure storage:', error)
  }

  if (!legacyTokens) return null
  await invoke('set_android_secure_value', {
    key: ONE_DRIVE_TOKEN_KEY,
    value: JSON.stringify(legacyTokens),
  })
  await store.delete(ONE_DRIVE_TOKEN_KEY)
  await store.save()
  return legacyTokens
}

async function refreshAccessToken(config: CloudFolderConfig, tokens: OneDriveAuthTokens): Promise<string> {
  const clientId = configuredClientId(config)
  if (!clientId) throw new Error('Microsoft Client ID is not configured')
  const { response, data } = await oauthRequest<OneDriveTokenResponse & OneDriveOAuthError>('token', new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    scope: ONE_DRIVE_SCOPE,
  }))
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'OneDrive authorization expired')
  }
  await saveTokens(data, tokens.refreshToken)
  return data.access_token
}

async function getAccessToken(config: CloudFolderConfig): Promise<string> {
  const tokens = await getStoredTokens()
  if (!tokens) throw new Error('OneDrive is not connected')
  if (tokens.expiresAt > Date.now()) return tokens.accessToken
  return refreshAccessToken(config, tokens)
}

async function graphRequest(
  config: CloudFolderConfig,
  pathOrUrl: string,
  init: RequestInit = {},
  allowNotFound = false,
): Promise<Response | null> {
  const request = async (accessToken: string) => fetchWithTransientRetry(() => fetch(
    pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`,
    {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  ))

  let response = await request(await getAccessToken(config))
  if (response.status === 401) {
    const tokens = await getStoredTokens()
    if (!tokens) throw new Error('OneDrive is not connected')
    response = await request(await refreshAccessToken(config, tokens))
  }
  if (allowNotFound && response.status === 404) return null
  if (!response.ok) {
    const body = await parseJson<OneDriveGraphError>(response).catch((): OneDriveGraphError => ({}))
    throw new Error(body.error?.message || `OneDrive request failed (${response.status})`)
  }
  return response
}

async function getAppRoot(config: CloudFolderConfig): Promise<OneDriveDriveItem> {
  const response = await graphRequest(config, '/me/drive/special/approot')
  if (!response) throw new Error('OneDrive application folder is unavailable')
  return parseJson<OneDriveDriveItem>(response)
}

async function getItem(config: CloudFolderConfig, key: string): Promise<OneDriveDriveItem | null> {
  const normalized = normalizeKey(key)
  const response = await graphRequest(
    config,
    `/me/drive/special/approot:/${encodePath(normalized)}`,
    {},
    true,
  )
  return response ? parseJson<OneDriveDriveItem>(response) : null
}

async function ensureParentFolder(config: CloudFolderConfig, key: string): Promise<OneDriveDriveItem> {
  const segments = normalizeKey(key).split('/').slice(0, -1)
  let current = getCachedFolder(config, '') || await getAppRoot(config)
  cacheFolder(config, '', current)
  let currentPath = ''

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    const cached = getCachedFolder(config, currentPath)
    if (cached) {
      current = cached
      continue
    }
    const existing = await getItem(config, currentPath)
    if (existing) {
      if (!existing.folder) throw new Error(`OneDrive path is not a folder: ${currentPath}`)
      current = existing
      cacheFolder(config, currentPath, current)
      continue
    }

    try {
      const response = await graphRequest(config, `/me/drive/items/${encodeURIComponent(current.id)}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segment,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      })
      if (!response) throw new Error(`Failed to create OneDrive folder: ${currentPath}`)
      current = await parseJson<OneDriveDriveItem>(response)
      cacheFolder(config, currentPath, current)
    } catch (error) {
      const concurrentlyCreated = await getItem(config, currentPath).catch(() => null)
      if (!concurrentlyCreated?.folder) throw error
      current = concurrentlyCreated
      cacheFolder(config, currentPath, current)
    }
  }
  return current
}

async function listChildren(config: CloudFolderConfig, folderId: string): Promise<OneDriveDriveItem[]> {
  const items: OneDriveDriveItem[] = []
  let nextUrl: string | undefined = `${GRAPH_BASE_URL}/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,size,eTag,cTag,lastModifiedDateTime,folder,file,deleted,parentReference`
  while (nextUrl) {
    const response = await graphRequest(config, nextUrl)
    if (!response) break
    const page = await parseJson<OneDriveChildrenResponse>(response)
    items.push(...page.value)
    nextUrl = page['@odata.nextLink']
  }
  return items
}

async function uploadLargeFile(
  config: CloudFolderConfig,
  key: string,
  content: Uint8Array,
): Promise<OneDriveDriveItem> {
  const encoded = encodePath(key)
  const sessionResponse = await graphRequest(
    config,
    `/me/drive/special/approot:/${encoded}:/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    },
  )
  if (!sessionResponse) throw new Error('Failed to create OneDrive upload session')
  const session = await parseJson<OneDriveUploadSession>(sessionResponse)

  let uploaded: OneDriveDriveItem | null = null
  for (let start = 0; start < content.byteLength; start += UPLOAD_CHUNK_SIZE) {
    const endExclusive = Math.min(start + UPLOAD_CHUNK_SIZE, content.byteLength)
    const chunk = content.slice(start, endExclusive)
    const response = await fetchWithTransientRetry(() => fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${endExclusive - 1}/${content.byteLength}`,
      },
      body: chunk,
    }))
    if (!response.ok) {
      const body = await parseJson<OneDriveGraphError>(response).catch((): OneDriveGraphError => ({}))
      throw new Error(body.error?.message || `OneDrive upload failed (${response.status})`)
    }
    if (response.status === 200 || response.status === 201) {
      uploaded = await parseJson<OneDriveDriveItem>(response)
    }
  }
  if (!uploaded) throw new Error('OneDrive upload did not complete')
  return uploaded
}

export function isOneDriveConfig(config: CloudFolderConfig): boolean {
  return config.provider === 'oneDrive'
}

export async function connectOneDrive(
  clientId: string,
  onCode: (code: OneDriveLoginCode) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<CloudFolderConfig> {
  const normalizedClientId = clientId.trim()
  if (!normalizedClientId) throw new Error('Microsoft Client ID is required')
  const { response, data } = await oauthRequest<OneDriveDeviceCodeResponse & OneDriveOAuthError>('devicecode', new URLSearchParams({
    client_id: normalizedClientId,
    scope: ONE_DRIVE_SCOPE,
  }))
  if (!response.ok || !data.device_code) {
    throw new Error(data.error_description || data.error || 'Failed to start Microsoft sign-in')
  }

  const verificationUrl = data.verification_uri_complete || data.verification_uri
  await onCode({
    userCode: data.user_code,
    verificationUrl,
    message: data.message || '',
    expiresAt: Date.now() + data.expires_in * 1000,
  })
  await openUrl(verificationUrl)

  let intervalMs = Math.max(5, data.interval || 5) * 1000
  const expiresAt = Date.now() + data.expires_in * 1000
  while (Date.now() < expiresAt) {
    if (signal?.aborted) throw new DOMException('OneDrive sign-in cancelled', 'AbortError')
    await waitForNextPoll(intervalMs, signal)

    const tokenResult = await oauthRequest<OneDriveTokenResponse & OneDriveOAuthError>('token', new URLSearchParams({
      client_id: normalizedClientId,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: data.device_code,
    }))
    if (tokenResult.response.ok && tokenResult.data.access_token) {
      await saveTokens(tokenResult.data)
      const draft: CloudFolderConfig = {
        path: ONE_DRIVE_APP_ROOT_PATH,
        provider: 'oneDrive',
        displayName: ONE_DRIVE_APP_ROOT_LABEL,
        oneDriveClientId: normalizedClientId,
      }
      const root = await getAppRoot(draft)
      return {
        ...draft,
        oneDriveRootId: root.id,
        oneDriveRootWebUrl: root.webUrl,
      }
    }

    switch (tokenResult.data.error) {
      case 'authorization_pending':
        continue
      case 'slow_down':
        intervalMs += 5000
        continue
      case 'authorization_declined':
      case 'access_denied':
        throw new Error('Microsoft sign-in was cancelled')
      case 'expired_token':
        throw new Error('Microsoft sign-in code expired')
      default:
        throw new Error(tokenResult.data.error_description || tokenResult.data.error || 'Microsoft sign-in failed')
    }
  }
  throw new Error('Microsoft sign-in code expired')
}

export async function disconnectOneDrive(): Promise<void> {
  folderCache.clear()
  await clearCloudFolderTreeCache()
  const store = await Store.load('store.json')
  if (platform() === 'android') {
    await invoke('delete_android_secure_value', { key: ONE_DRIVE_TOKEN_KEY })
  }
  await store.delete(ONE_DRIVE_TOKEN_KEY)
  await store.save()
}

export async function testOneDriveConnection(config: CloudFolderConfig): Promise<boolean> {
  if (!configuredClientId(config) || !await getStoredTokens()) return false
  if (!await getAppRoot(config)) return false

  const probeKey = `.notegen/sync-v1/.connection-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await oneDriveUpload(config, probeKey, 'NoteGen')
  try {
    return Boolean(await oneDriveHeadObject(config, probeKey))
  } finally {
    await oneDriveDelete(config, probeKey)
  }
}

export async function oneDriveUpload(
  config: CloudFolderConfig,
  key: string,
  content: string | Uint8Array,
): Promise<CloudFolderObject> {
  const normalized = normalizeKey(key)
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
  await ensureParentFolder(config, normalized)
  let item: OneDriveDriveItem
  if (bytes.byteLength <= SIMPLE_UPLOAD_LIMIT) {
    const response = await graphRequest(
      config,
      `/me/drive/special/approot:/${encodePath(normalized)}:/content`,
      { method: 'PUT', body: bytes },
    )
    if (!response) throw new Error('OneDrive upload failed')
    item = await parseJson<OneDriveDriveItem>(response)
  } else {
    item = await uploadLargeFile(config, normalized, bytes)
  }
  return toCloudFolderObject(normalized, item)
}

export async function oneDriveDownloadBytes(
  config: CloudFolderConfig,
  key: string,
): Promise<{ content: Uint8Array; etag: string; size: number; lastModified: string } | null> {
  const normalized = normalizeKey(key)
  const item = await getItem(config, normalized)
  if (!item?.file) return null
  const downloadUrl = item['@microsoft.graph.downloadUrl']
  if (!downloadUrl) throw new Error('OneDrive download URL is unavailable')
  // Graph's /content endpoint redirects to a pre-authenticated Microsoft
  // download URL. Forwarding the Graph bearer token to that host makes
  // personal OneDrive reject the request with 401, so download it directly.
  const response = await fetchWithTransientRetry(() => fetch(downloadUrl))
  if (!response.ok) {
    throw new Error(`OneDrive download failed (${response.status})`)
  }
  return {
    content: new Uint8Array(await response.arrayBuffer()),
    etag: itemEtag(item),
    size: item.size || 0,
    lastModified: item.lastModifiedDateTime || new Date(0).toISOString(),
  }
}

export async function oneDriveHeadObject(
  config: CloudFolderConfig,
  key: string,
): Promise<CloudFolderObject | null> {
  const normalized = normalizeKey(key)
  const item = await getItem(config, normalized)
  return item?.file ? toCloudFolderObject(normalized, item) : null
}

export async function oneDriveDelete(config: CloudFolderConfig, key: string): Promise<boolean> {
  const normalized = normalizeKey(key)
  const item = await getItem(config, normalized)
  if (!item) return true
  await graphRequest(config, `/me/drive/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }, true)
  return true
}

export async function oneDriveListObjects(
  config: CloudFolderConfig,
  prefix = '',
): Promise<CloudFolderObject[]> {
  const normalizedPrefix = prefix ? normalizeKey(prefix) : ''
  const start = normalizedPrefix ? await getItem(config, normalizedPrefix) : await getAppRoot(config)
  if (!start) return []
  if (start.file) return [toCloudFolderObject(normalizedPrefix, start)]
  if (!start.folder) return []

  const files: CloudFolderObject[] = []
  const queue: Array<{ item: OneDriveDriveItem; path: string }> = [{ item: start, path: normalizedPrefix }]
  while (queue.length) {
    const current = queue.shift()
    if (!current) break
    for (const item of await listChildren(config, current.item.id)) {
      if (item.deleted) continue
      const key = current.path ? `${current.path}/${item.name}` : item.name
      if (item.folder) queue.push({ item, path: key })
      else if (item.file) files.push(toCloudFolderObject(key, item))
    }
  }
  return files.sort((left, right) => left.key.localeCompare(right.key))
}
