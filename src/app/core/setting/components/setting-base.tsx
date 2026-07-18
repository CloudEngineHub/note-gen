import {
  Field,
  FieldDescription,
  FieldTitle,
} from "@/components/ui/field"

export function SettingType(
  {id, title, icon, desc, children}:
  { id: string, title: string, icon?: React.ReactNode, desc?: string, children?: React.ReactNode}
) {
  return <div id={id} className="flex flex-col gap-6">
    <header className="flex flex-col gap-1.5">
      <h2 className="flex w-full items-center gap-2 text-xl font-semibold tracking-tight">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {title}
      </h2>
      {desc && <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{desc}</p>}
    </header>
    {children}
  </div>
}

export function FormItem({title, desc, children}: { title: string, desc?: string, children: React.ReactNode}) {
  return <Field>
    <FieldTitle>{title}</FieldTitle>
    {children}
    {desc && <FieldDescription>{desc}</FieldDescription>}
  </Field>
}
