'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Check,
  Ellipsis,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { MemoryForm } from './memory-form'
import useMemoriesStore from '@/stores/memories'
import useSettingStore from '@/stores/setting'
import type { Memory } from '@/db/memories'

interface MemoryItemProps {
  memory: Memory
}

export function MemoryItem({ memory }: MemoryItemProps) {
  const t = useTranslations('settings.memories')
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const {
    approveMemory,
    archiveMemory,
    restoreMemory,
    permanentlyDeleteMemory,
    updateMemory,
  } = useMemoriesStore()
  const { systemPrompt, setSystemPrompt } = useSettingStore()
  const guidanceLine = `- ${memory.content.trim()}`
  const isPromoted = systemPrompt
    .split('\n')
    .some(line => line.trim() === guidanceLine)
  const archive = async () => {
    await archiveMemory(memory.id)
    toast(t('archived'), {
      action: {
        label: t('actions.undo'),
        onClick: () => void restoreMemory(memory.id),
      },
    })
  }

  const promoteToGuidance = async () => {
    if (isPromoted) return
    const next = [systemPrompt.trim(), guidanceLine].filter(Boolean).join('\n')
    await setSystemPrompt(next)
    await updateMemory(memory.id, { applyMode: 'always' })
    toast.success(t('promoted'))
  }

  const removeFromGuidance = async () => {
    const next = systemPrompt
      .split('\n')
      .filter(line => line.trim() !== guidanceLine)
      .join('\n')
      .trim()
    await setSystemPrompt(next)
    await updateMemory(memory.id, { applyMode: 'relevant' })
    toast.success(t('demoted'))
  }

  return (
    <>
      <Item variant="outline" size="sm">
        <ItemContent>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={memory.status === 'active' ? 'default' : 'secondary'}>
              {t(`statuses.${memory.status}`)}
            </Badge>
            <Badge variant="outline">{t(`kinds.${memory.kind}`)}</Badge>
            <Badge variant="outline">{t(`scopes.${memory.scopeType}`)}</Badge>
            {memory.applyMode === 'always' && (
              <Badge variant="secondary"><Pin />{t('always')}</Badge>
            )}
            {memory.sensitivity === 'suspected_sensitive' && (
              <Badge variant="destructive"><ShieldAlert />{t('sensitive.badge')}</Badge>
            )}
          </div>
          <ItemTitle className="line-clamp-2">{memory.content}</ItemTitle>
          <ItemDescription>
            {memory.lastRecallReason
              ? t('lastRecallReason', { reason: memory.lastRecallReason })
              : t('neverRecalled')}
            {' · '}
            {t('accessCount', { count: memory.accessCount })}
            {memory.indexingStatus !== 'ready' && ` · ${t(`indexing.${memory.indexingStatus}`)}`}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('actions.more')}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-max min-w-48 whitespace-nowrap"
            >
              <DropdownMenuGroup>
                {memory.status === 'pending' && (
                  <DropdownMenuItem onSelect={() => void approveMemory(memory.id)}>
                    <Check />
                    {t('actions.approve')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil />
                  {t('actions.edit')}
                </DropdownMenuItem>
                {isPromoted ? (
                  <DropdownMenuItem onSelect={() => void removeFromGuidance()}>
                    <PinOff />
                    {t('actions.demote')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void promoteToGuidance()}>
                    <Pin />
                    {t('actions.promote')}
                  </DropdownMenuItem>
                )}
                {memory.status === 'archived' ? (
                  <DropdownMenuItem onSelect={() => void restoreMemory(memory.id)}>
                    <RotateCcw />
                    {t('actions.restore')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void archive()}>
                    <Trash2 />
                    {t('actions.archive')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              {memory.status === 'archived' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      {t('actions.deletePermanently')}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          <MemoryForm memory={memory} onSuccess={() => setEditing(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void permanentlyDeleteMemory(memory.id)}
            >
              {t('actions.deletePermanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
