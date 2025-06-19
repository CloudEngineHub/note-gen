'use client'

import { LanguageSwitch } from "@/components/language-switch"
import { SettingTab } from "./components/setting-tab"
import { ModeToggle } from "@/components/mode-toggle"
import Updater from "@/app/core/setting/about/updater"
import UploadStore from "@/app/core/setting/components/upload-store"

export default function Setting() {
  return <div className="flex w-full h-full overflow-y-auto flex-col">
    <div className="h-12 flex items-center justify-between p-2 border-b overflow-hidden">
      <div className="flex items-center gap-2">
        <LanguageSwitch />
        <ModeToggle />
      </div>
      <div className="flex items-center gap-2">
        <UploadStore />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 my-4">
        <Updater />
      </div>
      <SettingTab />
    </div>
  </div>
}