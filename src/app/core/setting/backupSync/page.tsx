'use client';
import { FileUp } from "lucide-react"
import { useTranslations } from 'next-intl';
import { SettingType } from '../components/setting-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebdavSync from './webdav-sync';

export default function SyncPage() {
  const t = useTranslations('settings.backupSync');
  
  return (
    <SettingType id="sync" icon={<FileUp />} title={t('title')} desc={t('desc')}>
      <Tabs defaultValue="Webdav">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="Webdav">Webdav</TabsTrigger>
          <TabsTrigger disabled value="Others">Under development...</TabsTrigger>
        </TabsList>
        <TabsContent value="Webdav">
          <WebdavSync />
        </TabsContent>
        <TabsContent value="Others">
          <p>Under development...</p>
        </TabsContent>
      </Tabs>
    </SettingType>
  )
}
