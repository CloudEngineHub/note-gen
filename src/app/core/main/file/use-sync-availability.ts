'use client'

import { useCallback, useEffect, useState } from 'react'

import useSettingStore from '@/stores/setting'
import { useSettingsDialogStore } from '@/stores/settings-dialog'
import type { SyncPlatform } from '@/types/sync'
import { useShallow } from 'zustand/react/shallow'

import { getSyncConfiguration } from './file-tree-action-policy'

export function useSyncAvailability() {
  const credentials = useSettingStore(useShallow(state => ({
    primaryBackupMethod: state.primaryBackupMethod,
    accessToken: state.accessToken,
    githubUsername: state.githubUsername,
    giteeAccessToken: state.giteeAccessToken,
    gitlabAccessToken: state.gitlabAccessToken,
    gitlabUsername: state.gitlabUsername,
    giteaAccessToken: state.giteaAccessToken,
    giteaUsername: state.giteaUsername,
  })))
  const settingsOpen = useSettingsDialogStore(state => state.open)
  const [state, setState] = useState<{ configured: boolean; platform: SyncPlatform }>({
    configured: false,
    platform: credentials.primaryBackupMethod,
  })
  const [configurationRevision, setConfigurationRevision] = useState(0)

  const refresh = useCallback(async () => {
    const next = await getSyncConfiguration()
    setState(next)
    return next
  }, [])

  useEffect(() => {
    setConfigurationRevision(revision => revision + 1)
    void refresh()
  }, [credentials, refresh, settingsOpen])

  return { ...state, configurationRevision, refresh }
}
