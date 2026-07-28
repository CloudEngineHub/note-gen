import { notFound } from 'next/navigation'

import SettingsVisualAuditHarness from './settings-visual-audit-harness'

export default function SettingsVisualAuditPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <SettingsVisualAuditHarness />
}
