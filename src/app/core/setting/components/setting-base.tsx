import { ScrollArea } from '@/components/ui/scroll-area'

export function SettingType(
  {id, title, icon, desc, children}:
  { id: string, title: string, icon?: React.ReactNode, desc?: string, children?: React.ReactNode}
) {
  return <div id={id} className="flex h-full min-h-0 flex-col">
    <header className="shrink-0 px-8 pt-8 pb-6 pr-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5">
        <h2 className="flex w-full items-center gap-2 text-xl font-semibold tracking-tight">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {title}
        </h2>
        {desc && <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
    </header>
    <ScrollArea data-setting-scroll className="min-h-0 flex-1">
      <div className="px-8 pt-2 pb-8 pr-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {children}
        </div>
      </div>
    </ScrollArea>
  </div>
}

export function SettingSection({
  title,
  desc,
  actions,
  children,
}: {
  title: string
  desc?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
        </div>
        {actions}
      </header>
      {children ?? null}
    </section>
  )
}
