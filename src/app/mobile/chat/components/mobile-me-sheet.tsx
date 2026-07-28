"use client"

import { UserRound } from "lucide-react"
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion"
import { useTranslations } from "next-intl"
import { useLayoutEffect, useRef, useState } from "react"

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

const MOBILE_ME_RESTORE_OPEN_KEY = "mobile-me-restore-open"
const MOBILE_ME_RESTORE_INSTANT_KEY = "mobile-me-restore-open-instant"

export function MobileMeSheet({ indicator = false }: { indicator?: boolean }) {
  const reduceMotion = useReducedMotion()
  const tNavigation = useTranslations("navigation")
  const [open, setOpen] = useState(false)
  const [instantRestore, setInstantRestore] = useState(false)
  const swipeSurfaceRef = useRef<HTMLDivElement>(null)
  const surfaceX = useMotionValue(0)
  const avatarUrl = useSyncStore(state =>
    state.userInfo?.avatar_url
    || state.giteeUserInfo?.avatar_url
    || state.gitlabUserInfo?.avatar_url
    || state.giteaUserInfo?.avatar_url
    || ""
  )

  useLayoutEffect(() => {
    if (window.sessionStorage.getItem(MOBILE_ME_RESTORE_OPEN_KEY) !== "true") {
      return
    }

    const restoreInstantly = (
      window.sessionStorage.getItem(MOBILE_ME_RESTORE_INSTANT_KEY) === "true"
    )
    window.sessionStorage.removeItem(MOBILE_ME_RESTORE_OPEN_KEY)
    window.sessionStorage.removeItem(MOBILE_ME_RESTORE_INSTANT_KEY)

    if (restoreInstantly) {
      surfaceX.set(0)
      setInstantRestore(true)
      setOpen(true)
      requestAnimationFrame(() => setInstantRestore(false))
      return
    }

    openSheet()
  }, [])

  function getSurfaceWidth() {
    return swipeSurfaceRef.current?.offsetWidth
      ?? Math.min(window.innerWidth * 0.88, 360)
  }

  function moveSurface(
    target: number,
    onComplete?: () => void,
  ) {
    if (reduceMotion) {
      surfaceX.set(target)
      onComplete?.()
      return
    }

    animate(surfaceX, target, {
      type: "spring",
      stiffness: 520,
      damping: 42,
      onComplete,
    })
  }

  function openSheet() {
    surfaceX.set(-getSurfaceWidth())
    setOpen(true)
    requestAnimationFrame(() => moveSurface(0))
  }

  function closeSheet() {
    moveSurface(-getSurfaceWidth(), () => {
      setOpen(false)
      surfaceX.set(0)
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      openSheet()
      return
    }

    closeSheet()
  }

  function handleSwipeEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const width = swipeSurfaceRef.current?.offsetWidth ?? 360
    const shouldClose = info.offset.x <= -width * 0.25 || info.velocity.x <= -650

    if (shouldClose) {
      closeSheet()
      return
    }

    moveSurface(0)
  }

  function handleEdgePanStart() {
    surfaceX.set(-getSurfaceWidth())
    setOpen(true)
  }

  function handleEdgePan(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const width = getSurfaceWidth()
    surfaceX.set(Math.min(0, Math.max(-width, -width + Math.max(0, info.offset.x))))
  }

  function handleEdgePanEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const width = getSurfaceWidth()
    const shouldOpen = info.offset.x >= width * 0.25 || info.velocity.x >= 650

    if (shouldOpen) {
      moveSurface(0)
      return
    }

    closeSheet()
  }

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed inset-y-0 left-0 z-40 w-5 touch-pan-y"
        onPanStart={handleEdgePanStart}
        onPan={handleEdgePan}
        onPanEnd={handleEdgePanEnd}
      />

      <Sheet open={open} onOpenChange={handleOpenChange}>
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
            "gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none",
            "data-[side=left]:w-[88vw] data-[side=left]:max-w-[22.5rem] data-[side=left]:border-r-0",
            "duration-0 data-open:animate-none data-closed:animate-none"
          )}
        >
          <motion.div
            ref={swipeSurfaceRef}
            style={{ x: surfaceX }}
            className="relative flex h-full min-h-0 w-full touch-pan-y flex-col overflow-hidden border-r bg-background/95 shadow-2xl supports-backdrop-filter:bg-background/85"
            drag="x"
            dragConstraints={{ left: -480, right: 0 }}
            dragDirectionLock
            dragElastic={{ left: 0.04, right: 0 }}
            dragMomentum={false}
            onDragEnd={handleSwipeEnd}
          >
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -left-20 top-1/3 size-44 rounded-full bg-muted/70 blur-3xl" />

            <SheetTitle className="sr-only">{tNavigation("me")}</SheetTitle>
            <SheetDescription className="sr-only">{tNavigation("me")}</SheetDescription>

            <div className="relative min-h-0 flex-1 pt-[env(safe-area-inset-top)]">
              <MobileMePage
                embedded
                animateEntrance={!instantRestore}
                refreshOnMount={!instantRestore}
              />
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>
    </>
  )
}
