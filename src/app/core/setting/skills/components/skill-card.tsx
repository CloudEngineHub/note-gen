'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Trash, Loader2, Edit2 } from 'lucide-react'
import { useSkillsStore } from '@/stores/skills'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { inspectSkillPython, type SkillPythonStatus } from '@/lib/skills/runtime'
import { SkillMetadata } from '@/lib/skills/types'
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
  const { getSkill, updateSkillInstructions, deleteSkill } = useSkillsStore()

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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle className="text-lg">{skill.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleToggleEdit}
            >
              <Edit2 className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                  <Trash className="size-4" />
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
                  <AlertDialogAction onClick={handleDelete}>
                    {tc('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 truncate">
          {skill.description}
        </p>
        {hasPythonScripts && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('pythonRuntime')}:</span>
            {!pythonStatus ? (
              <Loader2 className="size-3 animate-spin" />
            ) : pythonStatus.available ? (
              <Badge variant="secondary">
                Python {pythonStatus.version} · {pythonStatus.managed ? t('isolatedRuntime') : t('systemRuntime')}
              </Badge>
            ) : (
              <Badge variant="destructive">{t('runtimeUnavailable')}</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* 指令编辑器 - 只在编辑模式下显示 */}
        {skillContent && isEditing && (
          <div className="mt-4 space-y-2">
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
                    <Loader2 className="size-3 animate-spin" />
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
              className="min-h-40 max-h-96 font-mono text-sm resize-y"
              placeholder={t('instructionsPlaceholder')}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
