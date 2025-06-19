"use client"
import { useTranslations } from 'next-intl'
import * as React from "react"
import { initMarksDb } from "@/db/marks"
import { ControlScan } from "./control-scan"
import { ControlText } from "./control-text"
import { ControlImage } from "./control-image"
import { ControlFile } from "./control-file"
import { ControlLink } from "./control-link"
import useMarkStore from "@/stores/mark"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from '@/components/ui/tooltip'
import { DownloadCloud, LoaderCircle, Menu, Trash2, UploadCloud, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function MarkHeader() {
  const t = useTranslations('record.mark');
  const { trashState, setTrashState, fetchAllTrashMarks, fetchMarks, uploadMarks, downloadMarks, syncState } = useMarkStore()

  async function upload() {
    const res = await uploadMarks()
    if (res) {
      toast({
        description: t('uploadSuccess'),
      })
    }
  }

  async function download() {
    const res = await downloadMarks()
    fetchMarks()
    if (res) {
      toast({
        description: t('downloadSuccess'),
      })
    }
  }

  React.useEffect(() => {
    initMarksDb()
  }, [])

  React.useEffect(() => {
    if (trashState) {
      fetchAllTrashMarks()
    } else {
      fetchMarks()
    }
  }, [trashState])

  return (
    <div className="flex justify-between items-center h-12 border-b px-2">
      <div className="flex">
        <TooltipProvider>
          <ControlText />
          <ControlScan />
          <ControlImage />
          <ControlLink />
          <ControlFile />
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-1">
        {
          trashState ? 
          <Button variant="ghost" size="icon" onClick={() => setTrashState(false)}><XCircle /></Button> :
          syncState ? 
            <Button variant="ghost" size="icon" disabled><LoaderCircle className="animate-spin size-4" /></Button> :
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTrashState(true)}>
                  <Trash2 />{t('toolbar.trash')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={upload}>
                  <UploadCloud />{t('type.upload')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={download}>
                  <DownloadCloud />{t('type.download')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        }
      </div>
    </div>
  )
}
