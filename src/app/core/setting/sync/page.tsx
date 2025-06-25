'use client';
import { FileUp } from "lucide-react"
import { useTranslations } from 'next-intl';
import { GithubSync } from "./github-sync";
import { GiteeSync } from "./gitee-sync";
import { SettingType } from '../components/setting-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SquareCheckBig } from "lucide-react"
import useSettingStore from "@/stores/setting";

export default function SyncPage() {
  const t = useTranslations();
  const { primaryBackupMethod } = useSettingStore()
  
  return (
    <SettingType id="sync" icon={<FileUp />} title={t('settings.sync.title')} desc={t('settings.sync.desc')}>
      <Tabs defaultValue="github">
        <TabsList className="grid grid-cols-2 w-full mb-8">
          <TabsTrigger value="github" className="flex items-center gap-2">
            Github
            {primaryBackupMethod === 'github' && <SquareCheckBig className="size-4" />}
          </TabsTrigger>
          <TabsTrigger value="gitee" className="flex items-center gap-2">
            Gitee
            {primaryBackupMethod === 'gitee' && <SquareCheckBig className="size-4" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="github">
          <GithubSync />
        </TabsContent>
        <TabsContent value="gitee">
          <GiteeSync />
        </TabsContent>
      </Tabs>
    </SettingType>
  )
}
