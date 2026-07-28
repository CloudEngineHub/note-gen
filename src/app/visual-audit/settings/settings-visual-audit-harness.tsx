'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

import { SettingsDialog } from '@/app/core/setting/components/settings-dialog'
import {
  settingSections,
  type SettingSection,
  useSettingsDialogStore,
} from '@/stores/settings-dialog'

function sectionFromLocation(): SettingSection {
  const section = new URLSearchParams(window.location.search).get('section')
  return settingSections.includes(section as SettingSection)
    ? section as SettingSection
    : 'about'
}

export default function SettingsVisualAuditHarness() {
  const [ready, setReady] = useState(false)
  const [metrics, setMetrics] = useState('')

  useLayoutEffect(() => {
    useSettingsDialogStore.setState({
      open: true,
      activeSection: sectionFromLocation(),
    })
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const frame = window.requestAnimationFrame(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      const rect = dialog?.getBoundingClientRect()
      setMetrics(JSON.stringify({
        viewport: [window.innerWidth, window.innerHeight],
        dialog: rect ? [rect.x, rect.y, rect.width, rect.height] : null,
      }))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [ready])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <div className="absolute inset-0 grid grid-cols-[240px_minmax(0,1fr)_360px] pt-9">
        <div className="border-r bg-sidebar" />
        <div className="bg-background" />
        <div className="border-l bg-background" />
      </div>
      {ready ? <SettingsDialog /> : null}
      <output id="visual-audit-metrics" className="hidden">{metrics}</output>
    </main>
  )
}
