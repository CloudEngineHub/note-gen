'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, ChevronsUpDown, FileText, Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CanvasChartRequest, CanvasChartType } from '@/types/canvas'

const CHART_TYPES: CanvasChartType[] = ['area', 'bar', 'line', 'pie', 'radar', 'radial']

interface NoteTreeNode {
  name: string
  path: string
  notePath?: string
  children: NoteTreeNode[]
}

function buildNoteTree(notes: Array<{ name: string; path: string }>) {
  const roots: NoteTreeNode[] = []
  const folders = new Map<string, NoteTreeNode>()
  for (const note of notes) {
    const parts = note.path.split('/').filter(Boolean)
    let children = roots
    for (let index = 0; index < Math.max(0, parts.length - 1); index += 1) {
      const path = parts.slice(0, index + 1).join('/')
      let folder = folders.get(path)
      if (!folder) {
        folder = { name: parts[index], path, children: [] }
        folders.set(path, folder)
        children.push(folder)
      }
      children = folder.children
    }
    children.push({
      name: note.name,
      path: note.path,
      notePath: note.path,
      children: [],
    })
  }
  const sortNodes = (nodes: NoteTreeNode[]) => {
    nodes.sort((a, b) => {
      const folderOrder = Number(Boolean(a.notePath)) - Number(Boolean(b.notePath))
      return folderOrder || a.name.localeCompare(b.name)
    })
    nodes.forEach(node => sortNodes(node.children))
  }
  sortNodes(roots)
  return roots
}

function filterNoteTree(nodes: NoteTreeNode[], query: string): NoteTreeNode[] {
  if (!query) return nodes
  return nodes.flatMap(node => {
    if (node.notePath) {
      return `${node.name} ${node.path}`.toLocaleLowerCase().includes(query) ? [node] : []
    }
    const children = filterNoteTree(node.children, query)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

function getNotePaths(node: NoteTreeNode): string[] {
  if (node.notePath) return [node.notePath]
  return node.children.flatMap(getNotePaths)
}

function NoteTreeItem({
  node,
  selectedPaths,
  searchActive,
  onSelectionChange,
}: {
  node: NoteTreeNode
  selectedPaths: string[]
  searchActive: boolean
  onSelectionChange: (paths: string[], selected: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const paths = getNotePaths(node)
  const selectedCount = paths.filter(path => selectedPaths.includes(path)).length
  const checked = selectedCount === paths.length
    ? true
    : selectedCount > 0 ? 'indeterminate' : false
  if (node.notePath) {
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
        <Checkbox
          checked={checked}
          onCheckedChange={value => onSelectionChange(paths, value === true)}
        />
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </label>
    )
  }
  return (
    <Collapsible open={searchActive || open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <Checkbox
          aria-label={node.name}
          checked={checked}
          onCheckedChange={value => onSelectionChange(paths, value === true)}
        />
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="min-w-0 flex-1 justify-start px-1.5 font-normal">
            <ChevronRight
              data-icon="inline-start"
              className={cn((searchActive || open) && 'rotate-90')}
            />
            <Folder data-icon="inline-start" />
            <span className="truncate">{node.name}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="ml-4 border-l pl-2">
        {node.children.map(child => (
          <NoteTreeItem
            key={child.path}
            node={child}
            selectedPaths={selectedPaths}
            searchActive={searchActive}
            onSelectionChange={onSelectionChange}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ChartEditorDialog({
  open,
  initialRequest,
  availableNotes,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initialRequest: CanvasChartRequest | null
  availableNotes: Array<{ name: string; path: string }>
  onOpenChange: (open: boolean) => void
  onSubmit: (request: CanvasChartRequest) => void
}) {
  const t = useTranslations('canvas')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [notePaths, setNotePaths] = useState<string[]>([])
  const [noteSearch, setNoteSearch] = useState('')
  const [requestedType, setRequestedType] = useState<CanvasChartRequest['requestedType']>('auto')

  useEffect(() => {
    if (!open) return
    setTitle(initialRequest?.title || '')
    setSource(initialRequest?.source || '')
    setNotePaths(initialRequest?.notePaths || [])
    setNoteSearch('')
    setRequestedType(initialRequest?.requestedType || 'auto')
  }, [initialRequest, open])

  const selectedNotes = notePaths.map(path => (
    availableNotes.find(note => note.path === path) || {
      name: path.split('/').pop() || path,
      path,
    }
  ))
  const noteTree = useMemo(() => buildNoteTree(availableNotes), [availableNotes])
  const filteredNoteTree = useMemo(
    () => filterNoteTree(noteTree, noteSearch.trim().toLocaleLowerCase()),
    [noteSearch, noteTree]
  )
  const updateNoteSelection = (paths: string[], selected: boolean) => {
    setNotePaths(current => {
      const next = new Set(current)
      paths.forEach(path => selected ? next.add(path) : next.delete(path))
      return [...next]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(800px,calc(100dvh-2rem))] w-[min(1080px,calc(100vw-2rem))] max-w-none grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:w-[min(1080px,calc(100vw-3rem))] sm:max-w-none">
        <DialogHeader className="gap-1 px-6 py-5 pr-12">
          <DialogTitle>{t(initialRequest ? 'chart.editTitle' : 'chart.createTitle')}</DialogTitle>
          <DialogDescription>{t('chart.description')}</DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="min-h-0 overflow-y-auto p-6">
          <FieldGroup className="gap-6">
            <FieldGroup className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_240px_320px]">
              <Field className="md:col-span-2 lg:col-span-1">
                <FieldLabel htmlFor="canvas-chart-title">{t('chart.titleLabel')}</FieldLabel>
                <Input
                  id="canvas-chart-title"
                  value={title}
                  placeholder={t('chart.titlePlaceholder')}
                  onChange={event => setTitle(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="canvas-chart-type">{t('chart.typeLabel')}</FieldLabel>
                <Select
                  value={requestedType}
                  onValueChange={value => setRequestedType(value as CanvasChartRequest['requestedType'])}
                >
                  <SelectTrigger id="canvas-chart-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="auto">{t('chart.types.auto')}</SelectItem>
                      {CHART_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{t(`chart.types.${type}`)}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('chart.notes.label')}</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {notePaths.length > 0
                          ? t('chart.notes.selected', { count: notePaths.length })
                          : t('chart.notes.placeholder')}
                      </span>
                      <ChevronsUpDown data-icon="inline-end" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[min(420px,calc(100vw-2rem))] p-0"
                  >
                    <PopoverHeader className="px-3 pt-3">
                      <PopoverTitle>{t('chart.notes.title')}</PopoverTitle>
                      <PopoverDescription>{t('chart.notes.description')}</PopoverDescription>
                    </PopoverHeader>
                    <div className="px-3 pb-3">
                      <Input
                        value={noteSearch}
                        placeholder={t('chart.notes.search')}
                        onChange={event => setNoteSearch(event.target.value)}
                      />
                    </div>
                    <Separator />
                    <ScrollArea className="h-72">
                      <div className="p-2">
                        {filteredNoteTree.length > 0 ? (
                          filteredNoteTree.map(node => (
                            <NoteTreeItem
                              key={node.path}
                              node={node}
                              selectedPaths={notePaths}
                              searchActive={Boolean(noteSearch.trim())}
                              onSelectionChange={updateNoteSelection}
                            />
                          ))
                        ) : (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            {t('chart.notes.empty')}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {selectedNotes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNotes.slice(0, 3).map(note => (
                      <Badge key={note.path} variant="secondary" className="max-w-full">
                        <span className="truncate">{note.name}</span>
                      </Badge>
                    ))}
                    {selectedNotes.length > 3 && (
                      <Badge variant="outline">+{selectedNotes.length - 3}</Badge>
                    )}
                  </div>
                )}
              </Field>
            </FieldGroup>

            <Field>
              <FieldLabel htmlFor="canvas-chart-source">{t('chart.dataLabel')}</FieldLabel>
              <Textarea
                id="canvas-chart-source"
                value={source}
                rows={10}
                maxRows={10}
                className="field-sizing-fixed h-[calc(10lh+1rem+2px)] min-h-[calc(10lh+1rem+2px)] max-h-[calc(10lh+1rem+2px)] resize-none font-mono text-xs"
                placeholder={t('chart.dataPlaceholder')}
                onChange={event => setSource(event.target.value)}
              />
              <FieldDescription>{t('chart.dataDescription')}</FieldDescription>
            </Field>
          </FieldGroup>
        </div>

        <Separator />

        <DialogFooter className="mx-0 mb-0 min-h-18 items-center rounded-none border-t-0 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('chart.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!source.trim() && notePaths.length === 0}
            onClick={() => {
              const nextTitle = title.trim()
              const initialTitle = initialRequest?.title.trim() || ''
              const initialTitleMode = initialRequest?.titleMode || 'auto'
              const titleMode = nextTitle === initialTitle
                ? initialTitleMode
                : nextTitle ? 'manual' : 'auto'
              onSubmit({
                title: nextTitle,
                titleMode,
                source: source.trim(),
                notePaths,
                requestedType,
              })
              onOpenChange(false)
            }}
          >
            {t(initialRequest ? 'chart.update' : 'chart.insert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
