'use client'

import { useEffect, useRef, useState } from 'react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Store } from '@tauri-apps/plugin-store'
import { ExternalLink, LogIn, LogOut, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import {
  releaseAndroidSyncFolder,
  testCloudFolderConnection,
} from '@/lib/sync/cloud-folder'
import {
  connectOneDrive,
  disconnectOneDrive,
  ONE_DRIVE_CLIENT_ID,
  type OneDriveLoginCode,
} from '@/lib/sync/onedrive'
import useSyncStore from '@/stores/sync'
import type { CloudFolderConfig } from '@/types/sync'

export function AndroidCloudFolderSync() {
  const t = useTranslations('settings.sync.cloudFolder')
  const oneDriveT = useTranslations('settings.sync.oneDrive')
  const cloudFolderConnected = useSyncStore(state => state.cloudFolderConnected)
  const setCloudFolderConnected = useSyncStore(state => state.setCloudFolderConnected)
  const [config, setConfig] = useState<CloudFolderConfig>({ path: '' })
  const [clientId, setClientId] = useState(ONE_DRIVE_CLIENT_ID)
  const [initialized, setInitialized] = useState(false)
  const [pendingAction, setPendingAction] = useState<'oneDrive' | 'disconnect' | null>(null)
  const [loginCode, setLoginCode] = useState<OneDriveLoginCode | null>(null)
  const [error, setError] = useState('')
  const loginAbortController = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        const store = await Store.load('store.json')
        const saved = await store.get<CloudFolderConfig>('cloudFolderSyncConfig')
        if (!saved?.path) return
        setConfig(saved)
        setClientId(saved.oneDriveClientId || ONE_DRIVE_CLIENT_ID)
        const connected = await testCloudFolderConnection(saved)
        if (cancelled) return
        setCloudFolderConnected(connected)
      } catch (cause) {
        if (cancelled) return
        console.error('Failed to initialize Android cloud sync:', cause)
        setCloudFolderConnected(false)
        setError(cause instanceof Error ? cause.message : t('accessFailedDescription'))
      } finally {
        if (!cancelled) setInitialized(true)
      }
    }

    void initialize()
    return () => {
      cancelled = true
      loginAbortController.current?.abort()
    }
  }, [setCloudFolderConnected, t])

  async function activateConfig(next: CloudFolderConfig) {
    const [autoDataSyncQueue, { getSyncPushQueue }] = await Promise.all([
      import('@/lib/sync/auto-data-sync-queue'),
      import('@/lib/sync/sync-push-queue'),
    ])
    const syncPushQueue = getSyncPushQueue()
    await Promise.all([
      autoDataSyncQueue.prepareAutoDataSyncForRepositoryChange(),
      syncPushQueue.prepareForWorkspaceSwitch(),
    ])
    try {
      const store = await Store.load('store.json')
      await store.set('cloudFolderSyncConfig', next)
      await store.save()
      setConfig(next)
      setCloudFolderConnected(true)
    } finally {
      syncPushQueue.finishWorkspaceSwitch()
      autoDataSyncQueue.finishAutoDataSyncRepositoryChange()
    }

    if (config.path.startsWith('content://') && config.path !== next.path) {
      await releaseAndroidSyncFolder(config.path).catch(() => undefined)
    }
  }

  async function connect() {
    if (pendingAction) return
    setPendingAction('oneDrive')
    setError('')
    setLoginCode(null)
    const controller = new AbortController()
    loginAbortController.current = controller

    try {
      const next = await connectOneDrive(clientId, async code => {
        let copied = false
        try {
          await writeText(code.userCode, { label: 'NoteGen OneDrive sign-in code' })
          copied = true
        } catch (cause) {
          console.error('Failed to copy the OneDrive sign-in code:', cause)
        }
        setLoginCode({ ...code, copied })
      }, controller.signal)
      if (!await testCloudFolderConnection(next)) throw new Error(oneDriveT('connectFailed'))
      await activateConfig(next)
      setLoginCode(null)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      console.error('Failed to connect OneDrive:', cause)
      await disconnectOneDrive().catch(() => undefined)
      setError(cause instanceof Error ? cause.message : oneDriveT('connectFailed'))
    } finally {
      if (loginAbortController.current === controller) loginAbortController.current = null
      setPendingAction(null)
    }
  }

  async function openLoginPage() {
    if (!loginCode) return
    setError('')
    try {
      await writeText(loginCode.userCode, { label: 'NoteGen OneDrive sign-in code' })
      setLoginCode({ ...loginCode, copied: true })
      await openUrl(loginCode.verificationUrl)
    } catch (cause) {
      console.error('Failed to open the OneDrive sign-in page:', cause)
      setError(cause instanceof Error ? cause.message : oneDriveT('connectFailed'))
    }
  }

  async function disconnect() {
    if (pendingAction) return
    setPendingAction('disconnect')
    setError('')
    try {
      await disconnectOneDrive()
      const store = await Store.load('store.json')
      await store.set('cloudFolderSyncConfig', { path: '' } satisfies CloudFolderConfig)
      await store.save()
      setConfig({ path: '' })
      setCloudFolderConnected(false)
      setLoginCode(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : oneDriveT('disconnectFailed'))
    } finally {
      setPendingAction(null)
    }
  }

  if (!initialized) {
    return (
      <Alert>
        <Spinner />
        <AlertTitle>{oneDriveT('loadingTitle')}</AlertTitle>
        <AlertDescription>{oneDriveT('loadingDescription')}</AlertDescription>
      </Alert>
    )
  }

  const oneDriveConnected = config.provider === 'oneDrive' && Boolean(config.path) && cloudFolderConnected

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-sm font-semibold">{oneDriveT('title')}</h3>
            <p className="text-sm text-muted-foreground">{oneDriveT('description')}</p>
          </div>
          <div className="shrink-0">
            <Badge variant={oneDriveConnected ? 'default' : 'secondary'}>
              {oneDriveConnected ? oneDriveT('connected') : oneDriveT('disconnected')}
            </Badge>
          </div>
        </header>
        <FieldGroup>
          {!ONE_DRIVE_CLIENT_ID && !oneDriveConnected ? (
              <Field data-invalid={Boolean(error && !clientId.trim())}>
                <FieldLabel htmlFor="one-drive-client-id">{oneDriveT('clientId')}</FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupInput
                    id="one-drive-client-id"
                    value={clientId}
                    onChange={event => setClientId(event.target.value)}
                    placeholder={oneDriveT('clientIdPlaceholder')}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(error && !clientId.trim())}
                  />
                </InputGroup>
                <FieldDescription>{oneDriveT('clientIdDescription')}</FieldDescription>
              </Field>
          ) : null}

          <Field>
              <FieldLabel>{oneDriveT('folder')}</FieldLabel>
              <div className="flex min-w-0 gap-2">
                <InputGroup className="h-11 min-w-0 flex-1">
                  <InputGroupInput
                    readOnly
                    value={oneDriveConnected ? config.displayName || oneDriveT('folderValue') : ''}
                    placeholder={oneDriveT('notConnected')}
                    title={config.oneDriveRootWebUrl || oneDriveT('folderValue')}
                  />
                </InputGroup>
                {oneDriveConnected ? (
                  <Button
                    variant="outline"
                    disabled={Boolean(pendingAction)}
                    onClick={() => void disconnect()}
                  >
                    {pendingAction === 'disconnect' ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}
                    {oneDriveT('disconnect')}
                  </Button>
                ) : (
                  <Button disabled={Boolean(pendingAction) || !clientId.trim()} onClick={() => void connect()}>
                    {pendingAction === 'oneDrive' ? <Spinner data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
                    {pendingAction === 'oneDrive' ? oneDriveT('connecting') : oneDriveT('connect')}
                  </Button>
                )}
              </div>
              <FieldDescription>{oneDriveT('folderDescription')}</FieldDescription>
          </Field>

          {loginCode ? (
              <Alert>
                <LogIn />
                <AlertTitle>{oneDriveT('signInTitle')}</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    {oneDriveT(loginCode.copied ? 'signInDescriptionCopied' : 'signInDescription', {
                      code: loginCode.userCode,
                    })}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void openLoginPage()}>
                    <ExternalLink data-icon="inline-start" />
                    {oneDriveT('openSignIn')}
                  </Button>
                </AlertDescription>
              </Alert>
          ) : null}
        </FieldGroup>
      </section>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('accessFailedTitle')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
