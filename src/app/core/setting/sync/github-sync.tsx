'use client'
import { Input } from "@/components/ui/input";
import { FormItem, SettingPanel, SettingRow } from "../components/setting-base";
import { useEffect } from "react";
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSettingStore from "@/stores/setting";
import { Store } from "@tauri-apps/plugin-store";
import useSyncStore from "@/stores/sync";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenBroswer } from "@/components/open-broswer";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Button } from "@/components/ui/button";
import { checkSyncRepoState, createSyncRepo, getUserInfo } from "@/lib/github";
import { RepoNames, SyncStateEnum } from "@/lib/github.types";
import { DatabaseBackup } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

dayjs.extend(relativeTime)

export function GithubSync() {
  const t = useTranslations();
  const { accessToken,
    setAccessToken,
    autoSync,
    setAutoSync,
    primaryBackupMethod,
    setPrimaryBackupMethod
  } = useSettingStore()
  const {
    syncRepoState,
    setSyncRepoState,
    syncRepoInfo,
    setSyncRepoInfo
  } = useSyncStore()

  // 检查 GitHub 仓库状态
  async function checkGithubRepos() {
    try {
      setSyncRepoState(SyncStateEnum.checking)
      await getUserInfo();
      // 检查同步仓库状态
      const syncRepo = await checkSyncRepoState(RepoNames.sync)
      if (syncRepo) {
        setSyncRepoInfo(syncRepo)
        setSyncRepoState(SyncStateEnum.success)
      } else {
        setSyncRepoState(SyncStateEnum.creating)
        const info = await createSyncRepo(RepoNames.sync, true)
        if (info) {
          setSyncRepoInfo(info)
          setSyncRepoState(SyncStateEnum.success)
        } else {
          setSyncRepoState(SyncStateEnum.fail)
        }
      }
    } catch (err) {
      console.error('Failed to check GitHub repos:', err)
      setSyncRepoState(SyncStateEnum.fail)
    }
  }

  async function tokenChangeHandler(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (value === '') {
      setSyncRepoState(SyncStateEnum.fail)
      setSyncRepoInfo(undefined)
    }
    setAccessToken(value)
    const store = await Store.load('store.json');
    await store.set('accessToken', value)
    if (value) {
      checkGithubRepos()
    }
  }

  useEffect(() => {
    async function init() {
      const store = await Store.load('store.json');
      const token = await store.get<string>('accessToken')
      if (token) {
        setAccessToken(token)
      } else {
        setAccessToken('')
      }
    }
    init()
    if (accessToken) {
      checkGithubRepos()
    }
  }, [])

  return (
    <div className="mt-4">
      <SettingRow>
        <FormItem title="Github Access Token" desc={t('settings.sync.newTokenDesc')}>
          <OpenBroswer url="https://github.com/settings/tokens/new" title={t('settings.sync.newToken')} className="mb-2" />
          <Input value={accessToken} onChange={tokenChangeHandler} />
        </FormItem>
      </SettingRow>
      <SettingRow>
        <FormItem title={t('settings.sync.repoStatus')}>
          <Card>
            <CardHeader className={`${syncRepoInfo ? 'border-b' : ''}`}>
              <CardTitle className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <DatabaseBackup className="size-4" />
                  {t('settings.sync.syncRepo')}（{ syncRepoInfo?.private === false ? t('settings.sync.public') : t('settings.sync.private') }）
                </div>
                <Badge className={`${syncRepoState === SyncStateEnum.success ? 'bg-green-800' : 'bg-red-800'}`}>{syncRepoState}</Badge>
              </CardTitle>
              <CardDescription>{t('settings.sync.syncRepoDesc')}</CardDescription>
            </CardHeader>
            {
              syncRepoInfo &&
              <CardContent className="flex items-center gap-4 mt-4">
                <Avatar className="size-12"  >
                  <AvatarImage src={syncRepoInfo?.owner.avatar_url || ''} />
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold mb-1">
                    <OpenBroswer title={syncRepoInfo?.full_name || ''} url={syncRepoInfo?.html_url || ''} />
                  </h3>
                  <CardDescription className="flex">
                    <p className="text-zinc-500 leading-6">{t('settings.sync.createdAt', { time: dayjs(syncRepoInfo?.created_at).fromNow() })}，</p>
                    <p className="text-zinc-500 leading-6">{t('settings.sync.updatedAt', { time: dayjs(syncRepoInfo?.updated_at).fromNow() })}。</p>
                  </CardDescription>
                </div>
              </CardContent>
            }
          </Card>
        </FormItem>
      </SettingRow>
      {
        syncRepoInfo &&
        <>
          <SettingPanel title="自动同步" desc="选择编辑器在输入停止后自动同步的时间间隔">
            <Select
              value={autoSync}
              onValueChange={(value) => setAutoSync(value)}
              disabled={!accessToken || syncRepoState !== SyncStateEnum.success}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('settings.sync.autoSyncOptions.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">{t('settings.sync.autoSyncOptions.disabled')}</SelectItem>
                <SelectItem value="10">{t('settings.sync.autoSyncOptions.10s')}</SelectItem>
                <SelectItem value="30">{t('settings.sync.autoSyncOptions.30s')}</SelectItem>
                <SelectItem value="60">{t('settings.sync.autoSyncOptions.1m')}</SelectItem>
                <SelectItem value="300">{t('settings.sync.autoSyncOptions.5m')}</SelectItem>
                <SelectItem value="1800">{t('settings.sync.autoSyncOptions.30m')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingPanel>
        </>
      }
      <SettingRow className="mb-4">
        {primaryBackupMethod === 'github' ? (
          <Button disabled variant="outline">
            {t('settings.sync.isPrimaryBackup', { type: 'Github' })}
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => setPrimaryBackupMethod('github')}
            disabled={!accessToken || syncRepoState !== SyncStateEnum.success}
          >
            {t('settings.sync.setPrimaryBackup')}
          </Button>
        )}
      </SettingRow>
    </div>
  )
}