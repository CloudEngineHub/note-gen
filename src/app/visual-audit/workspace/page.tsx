import { notFound } from 'next/navigation'

import WorkspaceVisualAuditHarness from './workspace-visual-audit-harness'

export default function WorkspaceVisualAuditPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <WorkspaceVisualAuditHarness />
}
