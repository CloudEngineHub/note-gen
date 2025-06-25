"use client"
import {TooltipButton} from "@/components/tooltip-button"
import {TooltipProvider} from "@/components/ui/tooltip"
import {RefreshCcw} from "lucide-react"
import * as React from "react"
import useImageStore from "@/stores/imageHosting"
import {Separator} from "@/components/ui/separator"
import {convertBytesToSize} from "@/lib/utils"
import {open} from '@tauri-apps/plugin-shell';
import useSettingStore from "@/stores/setting"
import { RepoNames } from '@/lib/github.types'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useTranslations } from 'next-intl'

export function ImageHeader() {
  const t = useTranslations('image')
  const {getImages, images, path, setPath} = useImageStore()
  const { githubUsername } = useSettingStore()
  const checkSetting = githubUsername && githubUsername.length > 0
  const handleOpenBroswer = (path: string) => {
    let url = ''
    if (path === '') {
      url = `https://github.com/${githubUsername}/${RepoNames.image}`
    } else {
      url = `https://github.com/${githubUsername}/${RepoNames.image}/tree/main/${path}`
    }
    open(url)
  }
  const backHandler = () => {
    setPath('')
    getImages()
  }

  return (
    checkSetting ? (
      <header className="h-12 flex items-center justify-between gap-2 border-b px-4 bg-primary-foreground">
        <div className="flex items-center h-6 gap-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="cursor-pointer">
                <BreadcrumbLink onClick={backHandler}>{t('root')}</BreadcrumbLink>
              </BreadcrumbItem>
              {
                path && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="cursor-pointer" onClick={() => handleOpenBroswer(path)}>
                      <BreadcrumbLink>{path}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </>
                )
              }
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center h-6 gap-1">
          <TooltipProvider>
            <div className="flex items-center h-6 gap-1">
              <span className="text-sm px-2">{images.length} 个文件</span>
              <Separator orientation="vertical"/>
              <span
                className="text-sm px-2">总大小：{convertBytesToSize(images.reduce((total, image) => total + image.size, 0))}</span>
              <Separator orientation="vertical"/>
            </div>
            <TooltipButton icon={<RefreshCcw/>} tooltipText="刷新" onClick={getImages}/>
          </TooltipProvider>
        </div>
      </header>
    ) : <></>
  )
}
