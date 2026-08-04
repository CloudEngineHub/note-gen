'use client'

import { FileDown, Loader2, RefreshCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { confirm } from '@tauri-apps/plugin-dialog'
import { platform } from '@tauri-apps/plugin-os'
import { Store } from '@tauri-apps/plugin-store'
import { GithubSync } from '@/app/core/setting/sync/github-sync'
import { GiteeSync } from '@/app/core/setting/sync/gitee-sync'
import { GitlabSync } from '@/app/core/setting/sync/gitlab-sync'
import { GiteaSync } from '@/app/core/setting/sync/gitea-sync'
import { S3Sync } from '@/app/core/setting/sync/s3-sync'
import { WebDAVSync } from '@/app/core/setting/sync/webdav-sync'
import { UsePlatformButton } from '@/app/core/setting/sync/components/use-platform-button'
import { WorkspaceRepoMapping } from '@/app/core/setting/sync/components/workspace-repo-mapping'
import { DataSyncOverview } from '@/app/core/setting/sync/components/data-sync-overview'
import { MobileSelectDrawer } from '@/app/mobile/components/mobile-select-drawer'
import { AndroidCloudFolderSync } from '@/app/mobile/setting/pages/sync/android-cloud-folder-sync'
import { IOSCloudFolderSync } from '@/app/mobile/setting/pages/sync/ios-cloud-folder-sync'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'
import { RepoNames, SyncStateEnum } from '@/lib/sync/github.types'
import type { SyncRepoPlatform, WorkspaceSyncRepos } from '@/lib/sync/workspace-repos'
import useSettingStore from '@/stores/setting'
import useSyncStore from '@/stores/sync'
import { SYNC_PLATFORMS, SYNC_PLATFORM_INFO, SyncPlatform } from '@/types/sync'

export default function SyncPage() {
  const t = useTranslations()
  const currentPlatform = platform()
  const isIOS = currentPlatform === 'ios'
  const isAndroid = currentPlatform === 'android'
  const availablePlatforms = isIOS || isAndroid
    ? SYNC_PLATFORMS
    : SYNC_PLATFORMS.filter(platformName => platformName !== 'cloudFolder')
  const {
    primaryBackupMethod,
    setPrimaryBackupMethod,
    autoSync,
    setAutoSync,
    autoRecordSyncEnabled,
    setAutoRecordSyncEnabled,
    autoSettingsSyncEnabled,
    setAutoSettingsSyncEnabled,
    autoConversationSyncEnabled,
    setAutoConversationSyncEnabled,
    excludeSensitiveConfig,
    setExcludeSensitiveConfig,
    autoPullOnOpen,
    setAutoPullOnOpen,
    workspacePath,
    workspaceHistory,
    setGithubCustomSyncRepo,
    setGiteeCustomSyncRepo,
    setGitlabCustomSyncRepo,
    setGiteaCustomSyncRepo,
  } = useSettingStore()
  const {
    syncRepoState,
    giteeSyncRepoState,
    gitlabSyncProjectState,
    giteaSyncRepoState,
    s3Connected,
    webdavConnected,
    cloudFolderConnected,
  } = useSyncStore()

  const [tab, setTab] = useState<SyncPlatform>(primaryBackupMethod)
  const [isLoading, setIsLoading] = useState(true)
  const [workspaceRepos, setWorkspaceRepos] = useState<Record<string, WorkspaceSyncRepos>>({})

  const workspaceOptions = useMemo(
    () => Array.from(new Set([workspacePath, '', ...workspaceHistory])),
    [workspaceHistory, workspacePath],
  )

  useEffect(() => {
    let cancelled = false

    async function loadWorkspaceRepos() {
      const { getWorkspaceSyncRepos } = await import('@/lib/sync/workspace-repos')
      const entries = await Promise.all(workspaceOptions.map(async (path) => {
        return [path, await getWorkspaceSyncRepos(path)] as const
      }))
      if (!cancelled) setWorkspaceRepos(Object.fromEntries(entries))
    }

    void loadWorkspaceRepos()
    return () => {
      cancelled = true
    }
  }, [workspaceOptions])

  async function handleWorkspaceRepoChange(workspacePath: string, repoPlatform: SyncRepoPlatform, repo: string) {
    const setters: Record<SyncRepoPlatform, (value: string, targetWorkspacePath?: string) => Promise<void>> = {
      github: setGithubCustomSyncRepo,
      gitee: setGiteeCustomSyncRepo,
      gitlab: setGitlabCustomSyncRepo,
      gitea: setGiteaCustomSyncRepo,
    }

    await setters[repoPlatform](repo, workspacePath)
    setWorkspaceRepos(current => ({
      ...current,
      [workspacePath]: {
        ...current[workspacePath],
        [repoPlatform]: repo,
      },
    }))
  }

  useEffect(() => {
    async function loadPrimaryBackupMethod() {
      try {
        const store = await Store.load('store.json')
        const savedMethod = await store.get<SyncPlatform>('primaryBackupMethod')
        if (savedMethod) {
          const nextMethod = savedMethod === 'cloudFolder' && !isIOS && !isAndroid ? 'github' : savedMethod
          await setPrimaryBackupMethod(nextMethod)
          setTab(nextMethod)
        }
      } catch (error) {
        console.error('Failed to load primary backup method:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadPrimaryBackupMethod()
  }, [isAndroid, isIOS, setPrimaryBackupMethod])

  const currentSyncState = getCurrentSyncState(tab)
  const isFileAutoSyncDisabled = currentSyncState !== SyncStateEnum.success

  function getCurrentSyncState(platform: SyncPlatform) {
    switch (platform) {
      case 'github':
        return syncRepoState
      case 'gitee':
        return giteeSyncRepoState
      case 'gitlab':
        return gitlabSyncProjectState
      case 'gitea':
        return giteaSyncRepoState
      case 's3':
        return s3Connected ? SyncStateEnum.success : SyncStateEnum.fail
      case 'webdav':
        return webdavConnected ? SyncStateEnum.success : SyncStateEnum.fail
      case 'cloudFolder':
        return cloudFolderConnected ? SyncStateEnum.success : SyncStateEnum.fail
      default:
        return syncRepoState
    }
  }

  function getProviderLabel(platform: SyncPlatform) {
    if (platform === 'cloudFolder') {
      return isIOS
        ? t('settings.sync.iCloud.title')
        : t('settings.sync.oneDrive.title')
    }
    return SYNC_PLATFORM_INFO[platform].name
  }

  function handleTabChange(value: string) {
    const nextTab = value as SyncPlatform
    setTab(nextTab)
  }

  async function handleExcludeSensitiveConfigChange(checked: boolean) {
    if (!checked) {
      const accepted = await confirm(t('settings.sync.autoDataSyncPrivacyDisableConfirm'), {
        title: t('settings.sync.autoDataSyncPrivacyTitle'),
        kind: 'warning',
      })
      if (!accepted) return
    }

    await setExcludeSensitiveConfig(checked)
  }

  function renderSyncContent() {
    switch (tab) {
      case 'github':
        return <GithubSync />
      case 'gitee':
        return <GiteeSync />
      case 'gitlab':
        return <GitlabSync />
      case 'gitea':
        return <GiteaSync />
      case 's3':
        return <S3Sync />
      case 'webdav':
        return <WebDAVSync />
      case 'cloudFolder':
        return isIOS ? <IOSCloudFolderSync /> : isAndroid ? <AndroidCloudFolderSync /> : <GithubSync />
      default:
        return <GithubSync />
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('settings.sync.desc')}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('settings.sync.platformSettings')}</h2>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <MobileSelectDrawer
              title={t('settings.sync.selectPlatform')}
              value={tab}
              onValueChange={handleTabChange}
              placeholder={t('settings.sync.selectPlatform')}
              className="h-11"
              options={availablePlatforms.map(platformName => ({
                value: platformName,
                label: getProviderLabel(platformName),
              }))}
            />
          </div>
          <div className="shrink-0 [&>button]:h-11">
            <UsePlatformButton
              platform={tab}
              disabled={currentSyncState !== SyncStateEnum.success}
            />
          </div>
        </div>
        {renderSyncContent()}
        {tab !== 's3' && tab !== 'webdav' && tab !== 'cloudFolder' ? (
          <WorkspaceRepoMapping
            platform={tab}
            workspaceOptions={workspaceOptions}
            currentWorkspacePath={workspacePath}
            workspaceRepos={workspaceRepos}
            defaultRepoName={RepoNames.sync}
            onRepoChange={(targetWorkspacePath, repo) => handleWorkspaceRepoChange(targetWorkspacePath, tab, repo)}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('settings.sync.noteSettings')}</h2>

        <Item variant="outline">
          <ItemMedia variant="icon"><RefreshCcw className="size-4" /></ItemMedia>
          <ItemContent>
            <ItemTitle>{t('settings.sync.autoSync')}</ItemTitle>
            <ItemDescription>{t('settings.sync.autoSyncDesc')}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <MobileSelectDrawer
              title={t('settings.sync.autoSync')}
              value={autoSync}
              onValueChange={(value) => setAutoSync(value)}
              disabled={isFileAutoSyncDisabled || (tab === 'cloudFolder' && !isAndroid)}
              className="min-w-32"
              placeholder={t('settings.sync.autoSyncOptions.placeholder')}
              options={[
                { value: 'disabled', label: t('settings.sync.autoSyncOptions.disabled') },
                { value: '2', label: t('settings.sync.autoSyncOptions.2s') },
                { value: '3', label: t('settings.sync.autoSyncOptions.3s') },
                { value: '5', label: t('settings.sync.autoSyncOptions.5s') },
                { value: '10', label: t('settings.sync.autoSyncOptions.10s') },
                { value: '20', label: t('settings.sync.autoSyncOptions.20s') },
                { value: '30', label: t('settings.sync.autoSyncOptions.30s') },
                { value: '60', label: t('settings.sync.autoSyncOptions.1m') },
                { value: '120', label: t('settings.sync.autoSyncOptions.2m') },
              ]}
            />
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon"><FileDown className="size-4" /></ItemMedia>
          <ItemContent>
            <ItemTitle>{t('settings.sync.autoPullOnOpen')}</ItemTitle>
            <ItemDescription>{t('settings.sync.autoPullOnOpenDesc')}</ItemDescription>
          </ItemContent>
          <ItemActions className="mobile-setting-inline-action">
            <Switch
              checked={autoPullOnOpen}
              onCheckedChange={setAutoPullOnOpen}
              disabled={isFileAutoSyncDisabled || (tab === 'cloudFolder' && !isAndroid)}
            />
          </ItemActions>
        </Item>

      </section>

      <DataSyncOverview
        mobile
        autoRecordSyncEnabled={autoRecordSyncEnabled}
        autoSettingsSyncEnabled={autoSettingsSyncEnabled}
        autoConversationSyncEnabled={autoConversationSyncEnabled}
        excludeSensitiveConfig={excludeSensitiveConfig}
        onRecordSyncChange={setAutoRecordSyncEnabled}
        onSettingsSyncChange={setAutoSettingsSyncEnabled}
        onConversationSyncChange={setAutoConversationSyncEnabled}
        onSensitiveConfigChange={handleExcludeSensitiveConfigChange}
      />
    </div>
  )
}
