'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import useCanvasStore from '@/stores/canvas'

const CanvasEditor = dynamic(
  () => import('@/app/core/main/canvas/canvas-editor').then(module => module.CanvasEditor),
  { ssr: false }
)

export default function MobileCanvasEditorPage() {
  const searchParams = useSearchParams()
  const canvasId = searchParams.get('id') || ''
  const router = useRouter()
  const t = useTranslations('canvas')
  const tNavigation = useTranslations('navigation')
  const project = useCanvasStore(state => state.projects.find(item => item.id === canvasId))
  const selectionContext = useCanvasStore(state => state.selectionContext)
  const openProject = useCanvasStore(state => state.openProject)

  useEffect(() => {
    if (canvasId) void openProject(canvasId)
  }, [canvasId, openProject])

  if (!canvasId) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="mobile-page-header flex shrink-0 items-center gap-2 border-b px-1">
        <Button variant="ghost" size="icon" aria-label={t('manager.title')} onClick={() => router.push('/mobile/canvas')}>
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          {project?.title || t('loading')}
        </h1>
        <Button
          variant={selectionContext?.canvasId === canvasId ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={selectionContext?.canvasId === canvasId
            ? t('selection.chatContext', {
              nodes: selectionContext.nodes.length,
              edges: selectionContext.edges.length,
            })
            : tNavigation('chat')}
          onClick={() => router.push('/mobile/chat')}
        >
          <MessageSquare />
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <CanvasEditor canvasId={canvasId} mobile />
      </div>
    </div>
  )
}
