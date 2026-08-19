'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TipTapEditor } from '@/app/core/main/editor/markdown/tiptap-editor'
import type { Editor } from '@tiptap/react'
import { Loader2 } from 'lucide-react'
import useArticleStore from '@/stores/article'

interface MobileEditorProps {
  onEditorReady?: (editor: Editor | null) => void
}

export interface MobileEditorHandle {
  flushPendingSave: () => Promise<void>
}

export const MobileEditor = forwardRef<MobileEditorHandle, MobileEditorProps>(function MobileEditor(
  { onEditorReady },
  ref,
) {
  const tEditor = useTranslations('editor')
  const {
    saveCurrentArticle,
    activeFilePath,
    currentArticle,
    loading: articleLoading,
  } = useArticleStore()

  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(activeFilePath))
  const [isEditorReady, setIsEditorReady] = useState(false)

  const activePathRef = useRef<string>('')
  const contentRef = useRef<string>('')
  const awaitingInitialContentRef = useRef(Boolean(activeFilePath))
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const savePromiseRef = useRef<Promise<void> | null>(null)

  // 监听 activeFilePath 变化
  useEffect(() => {
    if (activeFilePath && activeFilePath !== activePathRef.current) {
      activePathRef.current = activeFilePath
      awaitingInitialContentRef.current = true
      setIsLoading(true)
      setIsEditorReady(false)
    } else if (!activeFilePath && activePathRef.current) {
      activePathRef.current = ''
      awaitingInitialContentRef.current = false
      setContent('')
      contentRef.current = ''
      setIsLoading(false)
      setIsEditorReady(false)
    }
  }, [activeFilePath])

  // The article store owns the single disk read. Wait for its completed value so
  // large-document detection never runs against a temporary empty string.
  useEffect(() => {
    if (
      !activeFilePath
      || activePathRef.current !== activeFilePath
      || !awaitingInitialContentRef.current
      || articleLoading
    ) {
      return
    }

    awaitingInitialContentRef.current = false
    setContent(currentArticle)
    contentRef.current = currentArticle
    setIsLoading(false)
  }, [activeFilePath, articleLoading, currentArticle])

  // 保存文件
  const doSave = useCallback(async () => {
    const path = activePathRef.current
    const newContent = contentRef.current

    if (!path || !isEditorReady) {
      return
    }

    if (savePromiseRef.current) {
      await savePromiseRef.current
      return
    }

    const savePromise = saveCurrentArticle(newContent, path)
    savePromiseRef.current = savePromise
    try {
      await savePromise
    } finally {
      if (savePromiseRef.current === savePromise) {
        savePromiseRef.current = null
      }
    }
  }, [isEditorReady, saveCurrentArticle])

  useImperativeHandle(ref, () => ({
    flushPendingSave: async () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      if (savePromiseRef.current) {
        await savePromiseRef.current
      }
      await doSave()
    },
  }), [doSave])

  // 处理内容变化
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    contentRef.current = newContent

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      doSave()
    }, 500)
  }, [doSave])

  // 处理编辑器就绪
  const handleEditorReady = useCallback(() => {
    setIsEditorReady(true)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      onEditorReady?.(null)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [onEditorReady])

  // 显示加载状态
  if (isLoading || articleLoading || activeFilePath !== activePathRef.current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 relative w-full h-full flex flex-col">
      <TipTapEditor
        initialContent={content}
        onChange={handleContentChange}
        placeholder={tEditor('placeholder')}
        activeFilePath={activeFilePath}
        onReady={handleEditorReady}
        onEditorReady={onEditorReady}
        mobileMode
        applyLayoutPreferences
      />
    </div>
  )
})

export default MobileEditor
