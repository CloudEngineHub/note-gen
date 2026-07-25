'use client'

import { useTranslations } from 'next-intl'
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
} from '@/components/ui/item'
import { PenTool, Zap, GitCommit } from 'lucide-react'
import { ModelSelect } from './model-select'
import { SettingSection } from './setting-base'

interface DefaultModelsSettingsProps {
  type: 'editor' | 'record'
}

export function DefaultModelsSettings({ type }: DefaultModelsSettingsProps) {
  const t = useTranslations('settings')

  return (
    <SettingSection title={t('defaultModels.title')}>
      <ItemGroup>
      {/* Record - MarkDesc */}
      {type === 'record' && (
        <Item variant="outline">
          <ItemMedia variant="icon">
            <PenTool className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t('record.model.markDesc.title')}</ItemTitle>
            <ItemDescription>{t('record.model.markDesc.desc')}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ModelSelect modelKey="markDesc" />
          </ItemActions>
        </Item>
      )}

      {/* Editor - Completion & Commit */}
      {type === 'editor' && (
        <>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <GitCommit className="size-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('editor.commit.model.title')}</ItemTitle>
              <ItemDescription>{t('editor.commit.model.desc')}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ModelSelect modelKey="commit" />
            </ItemActions>
          </Item>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <Zap className="size-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('editor.completion.model.title')}</ItemTitle>
              <ItemDescription>{t('editor.completion.model.desc')}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ModelSelect modelKey="completion" />
            </ItemActions>
          </Item>
        </>
      )}
      </ItemGroup>
    </SettingSection>
  )
}
