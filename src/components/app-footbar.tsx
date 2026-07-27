'use client'

import { Highlighter, MessageSquare, Palette, Plus, Square, SquarePen } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Store } from '@tauri-apps/plugin-store'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import {
  InteractiveMenu,
  type InteractiveMenuItem,
} from '@/components/ui/modern-mobile-menu'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import { MobileRecordTools } from '@/components/mobile-record-tools'
import { OrganizeNotes } from '@/app/core/main/mark/organize-notes'
import useRecordingStore from '@/stores/recording'
import emitter from '@/lib/emitter'

type FootbarItem = InteractiveMenuItem & {
  url: string
  isQuickAction?: boolean
}

function RecordingDockIcon() {
  return (
    <span className="inline-flex size-5 items-center justify-center text-red-500">
      <Square className="size-4 animate-pulse fill-current" />
    </span>
  )
}

function formatRecordingDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AppFootbar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations()
  const [quickActionOpen, setQuickActionOpen] = useState(false)
  const organizeRef = useRef<{ openOrganize: () => void }>(null)
  const { isRecording, recordingDuration } = useRecordingStore()

  const items: FootbarItem[] = [
    {
      id: 'chat',
      label: t('navigation.mobileDock.chat'),
      url: '/mobile/chat',
      icon: MessageSquare,
    },
    {
      id: 'writing',
      label: t('navigation.mobileDock.write'),
      url: '/mobile/writing',
      icon: SquarePen,
    },
    {
      id: 'quick-action',
      label: isRecording
        ? formatRecordingDuration(recordingDuration)
        : t('navigation.mobileDock.quickRecord'),
      url: '#quick-action',
      icon: Plus,
      iconElement: isRecording ? <RecordingDockIcon /> : undefined,
      isQuickAction: true,
    },
    {
      id: 'record',
      label: t('navigation.mobileDock.record'),
      url: '/mobile/record',
      icon: Highlighter,
    },
    {
      id: 'canvas',
      label: t('navigation.mobileDock.canvas'),
      url: '/mobile/canvas',
      icon: Palette,
    },
  ]

  const routeActiveIndex = items.findIndex(item => {
    if (item.id === 'chat' && pathname.startsWith('/mobile/setting')) return true
    return pathname === item.url
  })
  const quickActionIndex = items.findIndex(item => item.isQuickAction)
  const activeIndex =
    (isRecording || quickActionOpen) && quickActionIndex >= 0
      ? quickActionIndex
      : Math.max(routeActiveIndex, 0)

  async function menuHandler(item: FootbarItem) {
    if (item.isQuickAction) {
      if (isRecording) {
        setQuickActionOpen(false)
        emitter.emit('toolbar-shortcut-recording')
        return
      }
      setQuickActionOpen(open => !open)
      return
    }

    setQuickActionOpen(false)
    router.push(item.url)
    const store = await Store.load('store.json')
    await store.set('currentPage', item.url)
  }

  function handleMobileOrganize() {
    setQuickActionOpen(false)
    window.requestAnimationFrame(() => {
      organizeRef.current?.openOrganize()
    })
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-2 min-[380px]:px-3">
      <Popover open={quickActionOpen} onOpenChange={setQuickActionOpen}>
        <PopoverAnchor asChild>
          <InteractiveMenu
            accentColor={isRecording ? 'rgb(239 68 68)' : undefined}
            activeIndex={activeIndex}
            aria-label={t('navigation.navigate')}
            className="w-full"
            items={items}
            onActiveIndexChange={index => {
              const item = items[index]
              if (item) void menuHandler(item)
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="center"
          side="top"
          sideOffset={10}
          collisionPadding={12}
          className="origin-bottom w-[min(92vw,360px)] rounded-[1.35rem] border-border/60 bg-background/70 p-2 text-foreground shadow-[0_18px_48px_rgb(0_0_0/0.18)] backdrop-blur-xl will-change-[transform,opacity] supports-[backdrop-filter]:bg-background/60 data-[state=open]:duration-[220ms] data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in data-[state=closed]:slide-out-to-bottom-2 dark:shadow-[0_22px_54px_rgb(0_0_0/0.36)]"
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <MobileRecordTools
            onClose={() => setQuickActionOpen(false)}
            onOrganize={handleMobileOrganize}
          />
        </PopoverContent>
      </Popover>
      <OrganizeNotes ref={organizeRef} />
    </div>
  )
}
