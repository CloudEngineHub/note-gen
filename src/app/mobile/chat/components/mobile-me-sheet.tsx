"use client"

import { UserRound } from "lucide-react"
import { useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"

import { MobileMePage } from "@/app/mobile/setting/components/mobile-me-page"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import useSyncStore from "@/stores/sync"
import { cn } from "@/lib/utils"

export function MobileMeSheet({ indicator = false }: { indicator?: boolean }) {
  const reduceMotion = useReducedMotion()
  const tNavigation = useTranslations("navigation")
  const avatarUrl = useSyncStore(state =>
    state.userInfo?.avatar_url
    || state.giteeUserInfo?.avatar_url
    || state.gitlabUserInfo?.avatar_url
    || state.giteaUserInfo?.avatar_url
    || ""
  )

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tNavigation("me")}
          className="relative rounded-full transition-transform duration-300 active:scale-90 data-[state=open]:scale-90"
        >
          <Avatar className="size-7">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback>
              <UserRound />
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className={cn(
              "absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background",
              !indicator && "hidden"
            )}
          />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        overlayClassName="bg-background/20 duration-500 supports-backdrop-filter:backdrop-blur-md"
        className={cn(
          "gap-0 overflow-hidden border-r bg-background/95 p-0 shadow-2xl",
          "data-[side=left]:w-[88vw] data-[side=left]:max-w-[22.5rem]",
          "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] supports-backdrop-filter:bg-background/85",
          "data-[side=left]:data-open:slide-in-from-left-full data-[side=left]:data-closed:slide-out-to-left-full",
          reduceMotion && "duration-0"
        )}
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-20 top-1/3 size-44 rounded-full bg-muted/70 blur-3xl" />

        <SheetTitle className="sr-only">{tNavigation("me")}</SheetTitle>
        <SheetDescription className="sr-only">{tNavigation("me")}</SheetDescription>

        <div className="relative min-h-0 flex-1 pt-[env(safe-area-inset-top)]">
          <MobileMePage embedded />
        </div>
      </SheetContent>
    </Sheet>
  )
}
