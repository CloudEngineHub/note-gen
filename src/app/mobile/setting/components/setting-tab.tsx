"use client";

import { useRouter } from "next/navigation";
import baseConfig, { type SettingNavigationGroup } from '@/app/core/setting/config'
import { useTranslations } from 'next-intl'
import { ChevronRight } from "lucide-react";
import type { ReactNode } from 'react'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import type { SettingSection } from '@/stores/settings-dialog'

const MOBILE_ME_SCROLL_KEY = 'mobile-me-scroll-top'

type MobileSettingNavigationItem =
  | {
      separator: SettingNavigationGroup
    }
  | {
      title: string
      icon: ReactNode
      anchor: SettingSection
    }

export function SettingTab() {
  const router = useRouter()
  const t = useTranslations('settings')
  const notMobilePages = ['about', 'canvas', 'file', 'shortcuts']
  
  const visibleConfig = baseConfig.reduce<MobileSettingNavigationItem[]>((items, item) => {
    if ('group' in item) {
      items.push({ separator: item.group })
    } else if (!notMobilePages.includes(item.anchor)) {
      items.push({
        ...item,
        title: t(item.anchor === 'ai' ? 'ai.menuTitle' : `${item.anchor}.title`),
      })
    }
    return items
  }, [])
  const config = visibleConfig.filter((item, index, items) => {
    if (!('separator' in item)) return true
    return index > 0
      && index < items.length - 1
      && !('separator' in items[index - 1])
  })

  function handleNavigation(anchor: string) {
    const mePage = document.getElementById('mobile-me')
    if (mePage) {
      window.sessionStorage.setItem(MOBILE_ME_SCROLL_KEY, String(mePage.scrollTop))
    }
    router.push(`/mobile/setting/pages/${anchor}`)
  }

  return (
    <ItemGroup className="gap-0 p-1">
      {
        config.map((item, index) => {
          if ('separator' in item) {
            return (
              <ItemSeparator key={`${item.separator}-${index}`} className="mx-3 my-1 w-auto" />
            )
          }
          
          return (
            <Item key={item.anchor} asChild className="mobile-setting-inline-item rounded-2xl active:bg-muted">
              <button type="button" onClick={() => handleNavigation(item.anchor)}>
                <ItemMedia variant="icon">{item.icon}</ItemMedia>
                <ItemContent>
                  <ItemTitle>{item.title}</ItemTitle>
                </ItemContent>
                <ItemActions className="mobile-setting-inline-action">
                  <ChevronRight className="size-4 text-muted-foreground" />
                </ItemActions>
              </button>
            </Item>
          )
        })
      }
    </ItemGroup>
  )
}
