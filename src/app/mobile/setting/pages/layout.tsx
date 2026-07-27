'use client'

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SwipeBack } from "@/components/ui/swipe-back";
import { SettingLayoutProvider } from "@/app/core/setting/components/setting-base";
import { useTranslations } from "next-intl";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter()
  const t = useTranslations('common')
  return (
    <SwipeBack>
      <div className="mobile-setting-screen flex h-full w-full flex-col overflow-y-auto bg-background pt-14">
        <div className="fixed left-0 right-0 top-[env(safe-area-inset-top)] z-10 flex h-14 items-center border-b border-border/60 bg-background/70 px-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label={t('back')}>
            <ArrowLeft />
          </Button>
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
