'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSkillsStore } from '@/stores/skills'
import { SkillsSettings } from '@/app/core/setting/skills/components/skills-settings'

export default function SkillsPage() {
  const t = useTranslations('settings.skills')
  const { initSkills } = useSkillsStore()

  useEffect(() => {
    initSkills()
  }, [initSkills])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </div>
      <SkillsSettings showFileActions={false} />
    </div>
  )
}
