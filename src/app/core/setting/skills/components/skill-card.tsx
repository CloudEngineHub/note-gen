'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sparkles, Trash, Edit2 } from 'lucide-react'
import { useSkillsStore } from '@/stores/skills'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { inspectSkillPython, type SkillPythonStatus } from '@/lib/skills/runtime'
import { SkillMetadata } from '@/lib/skills/types'
import { Spinner } from '@/components/ui/spinner'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SkillCardProps {
  skill: SkillMetadata
  onRefresh: () => void
}

export function SkillCard({ skill, onRefresh }: SkillCardProps) {
  const t = useTranslations('settings.skills')
  const tc = useTranslations('common')
  const { getSkill, toggleSkill, updateSkillInstructions, deleteSkill } = useSkillsStore()

  const [instructions, setInstructions] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [pythonStatus, setPythonStatus] = useState<SkillPythonStatus | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const skillContent = getSkill(skill.id)
  const hasPythonScripts = skillContent?.scripts.some(script => script.type === 'python') ?? false

  // 初始化指令内容
  useEffect(() => {
    if (skillContent) {
      setInstructions(skillContent.instructions)
    }
  }, [skillContent])

  useEffect(() => {
    if (!hasPythonScripts) return
    let active = true
    void inspectSkillPython(skill.id)
      .then(status => {
        if (active) setPythonStatus(status)
      })
      .catch(error => console.error('Failed to inspect Skill Python runtime:', error))
    return () => {
      active = false
    }
  }, [hasPythonScripts, skill.id])

  // 自动保存
  useEffect(() => {
    if (hasChanges && isEditing) {
      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // 设置新的定时器，1秒后保存
      saveTimeoutRef.current = setTimeout(async () => {
        await handleSave()
      }, 1000)

      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
      }
    }
  }, [instructions, hasChanges, isEditing])

  const handleDelete = async () => {
    try {
      await deleteSkill(skill.id)
      onRefresh()
    } catch (error) {
      console.error('Failed to delete skill:', error)
    }
  }

  const handleSave = async () => {
    if (!hasChanges) return

    try {
      setIsSaving(true)
      await updateSkillInstructions(skill.id, instructions)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save instructions:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInstructionsChange = (value: string) => {
    setInstructions(value)
    setHasChanges(true)
  }

  const handleToggleEdit = () => {
    setIsEditing(!isEditing)
  }

  return (
    <Item variant="outline">
      <ItemMedia variant="icon" className="text-muted-foreground">
        <Sparkles />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{skill.name}</ItemTitle>
        {skill.description ? <ItemDescription>{skill.description}</ItemDescription> : null}
        {hasPythonScripts && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('pythonRuntime')}:</span>
            {!pythonStatus ? (
              <Spinner />
            ) : pythonStatus.available ? (
              <Badge variant="secondary">
                Python {pythonStatus.version} · {pythonStatus.managed ? t('isolatedRuntime') : t('systemRuntime')}
              </Badge>
            ) : (
              <Badge variant="destructive">{t('runtimeUnavailable')}</Badge>
            )}
          </div>
        )}
      </ItemContent>
      <ItemActions>
        <Switch
          checked={skill.enabled !== false}
          onCheckedChange={() => toggleSkill(skill.id)}
          aria-label={`${t('enable')}: ${skill.name}`}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('editSkill')}
          onClick={handleToggleEdit}
        >
          <Edit2 />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon-sm" aria-label={t('deleteSkill')}>
              <Trash />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteSkillTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteSkillDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                {tc('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>
      {skillContent && isEditing && (
        <ItemFooter className="flex-col items-stretch gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t('instructions')}:
            </p>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-xs text-muted-foreground">
                  {tc('unsaved')}
                </span>
              )}
              {isSaving && (
                <div className="flex items-center gap-1">
                  <Spinner />
                  <span className="text-xs text-muted-foreground">
                    {tc('saving')}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Textarea
            value={instructions}
            onChange={(e) => handleInstructionsChange(e.target.value)}
            className="min-h-40 max-h-96 resize-y font-mono text-sm"
            placeholder={t('instructionsPlaceholder')}
          />
        </ItemFooter>
      )}
    </Item>
  )
}
