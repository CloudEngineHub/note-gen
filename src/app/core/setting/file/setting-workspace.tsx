'use client'

import { Button } from "@/components/ui/button"
import { FormItem, SettingRow } from "../components/setting-base"
import useSettingStore from "@/stores/setting"
import { open } from '@tauri-apps/plugin-dialog'
import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs"
import { useTranslations } from 'next-intl'
import useArticleStore from "@/stores/article"

export function SettingWorkspace() {
  const { workspacePath, setWorkspacePath } = useSettingStore()
  const {clearCollapsibleList, loadFileTree, setActiveFilePath, setCurrentArticle} = useArticleStore()
  const t = useTranslations('settings.file')

  // 选择工作区目录
  async function handleSelectWorkspace() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('workspace.select')
      })
      
      if (selected) {
        const path = selected as string
        await setWorkspacePath(path)
        await clearCollapsibleList()
        setActiveFilePath('')
        setCurrentArticle('')
        await loadFileTree()
      }
    } catch (error) {
      console.error('选择工作区失败:', error)
    }
  }

  // 重置为默认工作区
  async function handleResetWorkspace() {
    try {
      // 确保默认目录存在
      const exists1 = await exists('article', { baseDir: BaseDirectory.AppData })
      if (!exists1) {
        await mkdir('article', { baseDir: BaseDirectory.AppData })
      }
      await setWorkspacePath('')
      await clearCollapsibleList()
      setActiveFilePath('')
      setCurrentArticle('')
      await loadFileTree()
    } catch (error) {
      console.error('重置工作区失败:', error)
    }
  }

  return (
    <SettingRow>
      <FormItem 
        title={t('workspace.current')} 
        desc={t('workspace.desc')}
      >
        <div className="p-3 border rounded-md bg-muted/50 text-sm break-all">
          {workspacePath || t('workspace.default')}
        </div>
        <div className="flex gap-2 mt-2">
          <Button 
            onClick={handleSelectWorkspace}
          >
            {t('workspace.select')}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleResetWorkspace}
            disabled={!workspacePath}
          >
            {t('workspace.reset')}
          </Button>
        </div>
      </FormItem>
    </SettingRow>
    // <Card className="mb-6">
    //   <CardHeader>
    //     <CardTitle>{t('workspace.title')}</CardTitle>
    //     <CardDescription>
    //       {t('workspace.desc')}
    //     </CardDescription>
    //   </CardHeader>
    //   <CardContent>
        
    //   </CardContent>
    //   <CardFooter className="flex gap-4">
        
    //   </CardFooter>
    // </Card>
  )
}
