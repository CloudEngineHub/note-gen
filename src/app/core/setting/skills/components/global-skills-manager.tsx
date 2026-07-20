'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sparkles, Upload } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { useSkillsStore } from '@/stores/skills'
import { SkillCard } from './skill-card'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useToast } from '@/hooks/use-toast'
import { SettingSection } from '../../components/setting-base'

export function GlobalSkillsManager() {
  const t = useTranslations('settings.skills')
  const { toast } = useToast()
  const { globalSkills, refreshSkills } = useSkillsStore()
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = async () => {
    try {
      setIsImporting(true)

      // 选择 zip 文件
      const filePath = await open({
        title: t('selectSkillZip'),
        filters: [{
          name: 'ZIP Files',
          extensions: ['zip']
        }],
        multiple: false
      })

      if (!filePath || Array.isArray(filePath)) {
        setIsImporting(false)
        return
      }

      // 调用后端命令导入 Skill
      const skillName = await invoke<string>('import_skill_zip', { zipPath: filePath })

      toast({
        title: t('importSuccess'),
        description: `${skillName} ${t('imported')}`,
      })

      // 刷新 Skills 列表
      await refreshSkills()
    } catch (error) {
      console.error('Import skill failed:', error)
      toast({
        title: t('importError'),
        description: (error as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <SettingSection
      title={`${t('installedGlobalSkills')} (${globalSkills.length})`}
      desc={t('importHelp')}
      actions={(
        <Button variant="outline" size="sm" onClick={handleImport} disabled={isImporting}>
          {isImporting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          {isImporting ? t('importing') : t('importSkill')}
        </Button>
      )}
    >
      {globalSkills.length > 0 ? (
        <ItemGroup className="gap-2">
          {globalSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onRefresh={refreshSkills}
            />
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Sparkles /></EmptyMedia>
            <EmptyTitle>{t('noSkillsGlobal')}</EmptyTitle>
            <EmptyDescription>{t('noSkillsGlobalDesc')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </SettingSection>
  )
}
