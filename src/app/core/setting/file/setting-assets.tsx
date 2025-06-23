'use client'
import { Input } from "@/components/ui/input"
import { SettingRow, FormItem } from "../components/setting-base"
import { useTranslations } from 'next-intl'
import useSettingStore from "@/stores/setting"

export function SettingAssets() {
  const t = useTranslations('settings.file.assets')
  const { assetsPath, setAssetsPath } = useSettingStore()
  return (
    <SettingRow>
      <FormItem title={t('title')} desc={t('desc')}>
        <Input placeholder={t('select')} value={assetsPath} onChange={(e) => setAssetsPath(e.target.value)} />
      </FormItem>
    </SettingRow>
  )
}
