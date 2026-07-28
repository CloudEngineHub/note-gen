'use client'

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SwipeBack, type SwipeBackHandle } from "@/components/ui/swipe-back";
import { SettingLayoutProvider } from "@/app/core/setting/components/setting-base";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MobileMePage } from "@/app/mobile/setting/components/mobile-me-page";

const MOBILE_ME_RESTORE_OPEN_KEY = "mobile-me-restore-open"
const MOBILE_ME_RESTORE_INSTANT_KEY = "mobile-me-restore-open-instant"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('common')
  const settingsT = useTranslations('settings')
  const [restoreMeSheet, setRestoreMeSheet] = useState(false)
  const swipeBackRef = useRef<SwipeBackHandle>(null)
  const anchor = pathname.split('/').filter(Boolean).at(-1) ?? ''
  const title = anchor === 'pages'
    ? settingsT('title')
    : anchor === 'ai'
    ? settingsT('ai.menuTitle')
    : settingsT(`${anchor}.title`)

  useEffect(() => {
    setRestoreMeSheet(
      window.sessionStorage.getItem(MOBILE_ME_RESTORE_OPEN_KEY) === "true"
    )
  }, [])

  function handleSwipeBack() {
    if (restoreMeSheet) {
      window.sessionStorage.setItem(MOBILE_ME_RESTORE_OPEN_KEY, "true")
      window.sessionStorage.setItem(MOBILE_ME_RESTORE_INSTANT_KEY, "true")
    }
    router.back()
  }

  return (
    <SwipeBack
      ref={swipeBackRef}
      onBack={handleSwipeBack}
      backdrop={restoreMeSheet ? (
        <div className="flex h-full w-full bg-background/20">
          <div className="relative h-full w-[88vw] max-w-[22.5rem] overflow-hidden border-r bg-background/95 shadow-2xl supports-backdrop-filter:bg-background/85">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -left-20 top-1/3 size-44 rounded-full bg-muted/70 blur-3xl" />
            <div className="relative h-full min-h-0 pt-[env(safe-area-inset-top)]">
              <MobileMePage
                embedded
                animateEntrance={false}
                refreshOnMount={false}
              />
            </div>
          </div>
        </div>
      ) : undefined}
    >
      <div className="mobile-setting-screen flex h-full w-full flex-col overflow-y-auto bg-background pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <div className="fixed left-0 right-0 top-[env(safe-area-inset-top)] z-10 flex h-14 items-center border-b border-border/60 bg-background/70 px-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => swipeBackRef.current?.back()}
            aria-label={t('back')}
          >
            <ArrowLeft />
          </Button>
          <h1 className="min-w-0 flex-1 truncate pr-12 text-center text-base font-semibold">
            {title}
          </h1>
        </div>
        <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SettingLayoutProvider mobile>
            {children}
          </SettingLayoutProvider>
        </div>
      </div>
    </SwipeBack>
  )
}
