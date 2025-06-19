'use client'

import {
  Sidebar,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { useTranslations } from 'next-intl'
import React from "react"
import { TagManage } from '../tag'
import { MarkHeader } from './mark-header'
import { MarkList } from './mark-list'
import useMarkStore from "@/stores/mark"
import { Button } from "@/components/ui/button"
import { clearTrash } from "@/db/marks"
import { confirm } from '@tauri-apps/plugin-dialog';

export function NoteSidebar() {
  const t = useTranslations();
  const { trashState, marks, setMarks } = useMarkStore()

  async function handleClearTrash() {
    const res = await confirm(t('record.trash.confirm'), {
      title: t('record.trash.title'),
      kind: 'warning',
    })
    if (res) {
      await clearTrash()
      setMarks([])
    }
  }

  return (
    <Sidebar collapsible="none" className="border-r w-full lg:w-[300px]">
      <SidebarHeader className="p-0">
        <MarkHeader />
        {
          trashState ? 
          <div className="flex pl-2 relative border-b pb-2 h-6 items-center justify-between overflow-hidden">
            <p className="text-xs text-zinc-500">{t('record.trash.records', { count: marks.length })}</p>
            {
              marks.length > 0 ?
              <Button className="text-xs text-red-900" variant="link" onClick={handleClearTrash}>{t('record.trash.empty')}</Button> : null
            }
          </div>:
          <TagManage />
        }
      </SidebarHeader>
      <MarkList />
    </Sidebar>
  )
}