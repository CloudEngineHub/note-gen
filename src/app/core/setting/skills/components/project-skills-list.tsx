'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useSkillsStore } from '@/stores/skills'
import { SkillCard } from './skill-card'
import { SettingSection } from '../../components/setting-base'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'

export function ProjectSkillsList() {
  const t = useTranslations('settings.skills')
  const tc = useTranslations('common')
  const { projectSkills, refreshSkills } = useSkillsStore()

  const handleRefresh = async () => {
    await refreshSkills()
  }

  return (
    <SettingSection
      title={`${t('project')} (${projectSkills.length})`}
      actions={(
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw data-icon="inline-start" />
          {tc('refresh')}
        </Button>
      )}
    >
      {projectSkills.length > 0 ? (
        <ItemGroup className="gap-2">
          {projectSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onRefresh={handleRefresh}
            />
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
            <EmptyTitle>{t('emptyWorkspace')}</EmptyTitle>
            <EmptyDescription>{t('emptyWorkspaceDesc')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </SettingSection>
  )
}
