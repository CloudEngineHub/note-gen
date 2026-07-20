'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ServerList } from '@/app/core/setting/mcp/server-list'
import { useMcpStore } from '@/stores/mcp'

export default function McpSettingPage() {
  const t = useTranslations('settings.mcp')
  const { initMcpData } = useMcpStore()

  useEffect(() => {
    initMcpData()
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </header>
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">{t('mobileHttpOnlyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('mobileHttpOnlyDesc')}</p>
      </div>
      <div className="flex flex-col gap-6">
        <ServerList />
      </div>
    </div>
  )
}
