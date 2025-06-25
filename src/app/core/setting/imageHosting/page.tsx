'use client';
import { ImageUp, SquareCheckBig } from "lucide-react"
import { useTranslations } from 'next-intl';
import { SettingType } from '../components/setting-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GithubImageHosting } from "./github";

export default function ImageHostingPage() {
  const t = useTranslations();
  
  return (
    <SettingType id="imageHosting" icon={<ImageUp />} title={t('settings.imageHosting.title')} desc={t('settings.imageHosting.desc')}>
      <Tabs defaultValue="github">
        <TabsList className="grid grid-cols-2 w-full mb-8">
          <TabsTrigger value="github" className="flex items-center gap-2">
            Github
            <SquareCheckBig className="size-4" />
          </TabsTrigger>
          <TabsTrigger disabled value="SM.MS">Under development...</TabsTrigger>
        </TabsList>
        <TabsContent value="github">
          <GithubImageHosting />
        </TabsContent>
        <TabsContent value="SM.MS">
        </TabsContent>
      </Tabs>
    </SettingType>
  )
}
