'use client'

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, openSearchPanel, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface SourceMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSelectionChange?: (selection: { from: number; to: number }) => void
  selection?: { from: number; to: number }
  onControllerChange?: (controller: SourceMarkdownEditorController | null) => void
  onUndoRedoChange?: (state: { undo: boolean; redo: boolean }) => void
  onViewStateChange?: (state: SourceMarkdownEditorViewState) => void
  initialScrollTop?: number
  editable: boolean
  showLineNumbers: boolean
  lineWrapping: boolean
  fontSize: number
  lineHeight: number
  ariaLabel: string
  className?: string
}

export interface SourceMarkdownEditorController {
  undo: () => boolean
  redo: () => boolean
  getUndoRedoState: () => { undo: boolean; redo: boolean }
  openSearch: () => boolean
  find: (query: string) => boolean
  replaceValue: (
    value: string,
    selection?: { from: number; to: number }
  ) => void
}

export interface SourceMarkdownEditorViewState {
  selection: { from: number; to: number }
  scrollTop: number
}

function createEditorTheme(fontSize: number, lineHeight: number) {
  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: 'hsl(var(--foreground))',
      fontSize: `${fontSize}px`,
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: String(lineHeight),
      scrollbarGutter: 'stable',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '24px 16px',
      caretColor: 'hsl(var(--foreground))',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      minHeight: '100%',
      borderRight: '1px solid hsl(var(--border))',
      backgroundColor: 'color-mix(in oklab, hsl(var(--muted)) 20%, transparent)',
      color: 'hsl(var(--muted-foreground))',
    },
    '.cm-gutterElement': {
      paddingLeft: '8px',
      paddingRight: '12px',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'color-mix(in oklab, hsl(var(--muted)) 35%, transparent)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in oklab, hsl(var(--primary)) 24%, transparent) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'hsl(var(--foreground))',
    },
  })
}

export function SourceMarkdownEditor({
  value,
  onChange,
  onSelectionChange,
  selection,
  onControllerChange,
  onUndoRedoChange,
  onViewStateChange,
  initialScrollTop = 0,
  editable,
  showLineNumbers,
  lineWrapping,
  fontSize,
  lineHeight,
  ariaLabel,
  className,
}: SourceMarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onControllerChangeRef = useRef(onControllerChange)
  const onUndoRedoChangeRef = useRef(onUndoRedoChange)
  const onViewStateChangeRef = useRef(onViewStateChange)
  const appliedValueRef = useRef(value)
  const isApplyingExternalValueRef = useRef(false)
  const editableCompartmentRef = useRef(new Compartment())
  const gutterCompartmentRef = useRef(new Compartment())
  const wrappingCompartmentRef = useRef(new Compartment())
  const themeCompartmentRef = useRef(new Compartment())
  const attributesCompartmentRef = useRef(new Compartment())

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useEffect(() => {
    onControllerChangeRef.current = onControllerChange
  }, [onControllerChange])

  useEffect(() => {
    onUndoRedoChangeRef.current = onUndoRedoChange
  }, [onUndoRedoChange])

  useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange
  }, [onViewStateChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const initialSelectionFrom = Math.max(0, Math.min(selection?.from ?? 0, value.length))
    const initialSelectionTo = Math.max(
      initialSelectionFrom,
      Math.min(selection?.to ?? initialSelectionFrom, value.length)
    )

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: value,
        selection: { anchor: initialSelectionFrom, head: initialSelectionTo },
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          markdown(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          editableCompartmentRef.current.of([
            EditorState.readOnly.of(!editable),
            EditorView.editable.of(editable),
          ]),
          gutterCompartmentRef.current.of(
            showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
          ),
          wrappingCompartmentRef.current.of(lineWrapping ? EditorView.lineWrapping : []),
          themeCompartmentRef.current.of(createEditorTheme(fontSize, lineHeight)),
          attributesCompartmentRef.current.of(EditorView.contentAttributes.of({
            'aria-label': ariaLabel,
            autocapitalize: 'off',
            autocomplete: 'off',
            spellcheck: 'false',
          })),
          EditorView.updateListener.of((update) => {
            if (update.selectionSet) {
              const selection = update.state.selection.main
              onSelectionChangeRef.current?.({ from: selection.from, to: selection.to })
            }
            if (!update.docChanged) return

            onUndoRedoChangeRef.current?.({
              undo: undoDepth(update.state) > 0,
              redo: redoDepth(update.state) > 0,
            })
            if (isApplyingExternalValueRef.current) return

            const nextValue = update.state.doc.toString()
            appliedValueRef.current = nextValue
            onChangeRef.current(nextValue)
          }),
        ],
      }),
    })

    viewRef.current = view
    let restoreScrollFrame = window.requestAnimationFrame(() => {
      restoreScrollFrame = 0
      view.scrollDOM.scrollTop = initialScrollTop
    })
    const getUndoRedoState = () => ({
      undo: undoDepth(view.state) > 0,
      redo: redoDepth(view.state) > 0,
    })
    onControllerChangeRef.current?.({
      undo: () => {
        const didUndo = undo(view)
        if (didUndo) view.focus()
        return didUndo
      },
      redo: () => {
        const didRedo = redo(view)
        if (didRedo) view.focus()
        return didRedo
      },
      getUndoRedoState,
      openSearch: () => {
        const didOpen = openSearchPanel(view)
        if (didOpen) view.focus()
        return didOpen
      },
      find: (query) => {
        const normalizedQuery = query.trim().toLocaleLowerCase()
        if (!normalizedQuery) return false

        const index = view.state.doc.toString().toLocaleLowerCase().indexOf(normalizedQuery)
        if (index < 0) return false

        view.dispatch({
          selection: { anchor: index, head: index + query.trim().length },
          scrollIntoView: true,
        })
        view.focus()
        return true
      },
      replaceValue: (nextValue, nextSelection) => {
        const selectionFrom = Math.max(
          0,
          Math.min(nextSelection?.from ?? view.state.selection.main.from, nextValue.length)
        )
        const selectionTo = Math.max(
          selectionFrom,
          Math.min(nextSelection?.to ?? selectionFrom, nextValue.length)
        )
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextValue },
          selection: { anchor: selectionFrom, head: selectionTo },
          annotations: isolateHistory.of('full'),
        })
      },
    })
    onUndoRedoChangeRef.current?.(getUndoRedoState())
    const initialSelection = view.state.selection.main
    onSelectionChangeRef.current?.({
      from: initialSelection.from,
      to: initialSelection.to,
    })
    return () => {
      if (restoreScrollFrame) window.cancelAnimationFrame(restoreScrollFrame)
      const finalSelection = view.state.selection.main
      onViewStateChangeRef.current?.({
        selection: { from: finalSelection.from, to: finalSelection.to },
        scrollTop: view.scrollDOM.scrollTop,
      })
      onControllerChangeRef.current?.(null)
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    view.dispatch({
      effects: [
        editableCompartmentRef.current.reconfigure([
          EditorState.readOnly.of(!editable),
          EditorView.editable.of(editable),
        ]),
        gutterCompartmentRef.current.reconfigure(
          showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
        wrappingCompartmentRef.current.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
        themeCompartmentRef.current.reconfigure(createEditorTheme(fontSize, lineHeight)),
        attributesCompartmentRef.current.reconfigure(EditorView.contentAttributes.of({
          'aria-label': ariaLabel,
          autocapitalize: 'off',
          autocomplete: 'off',
          spellcheck: 'false',
        })),
      ],
    })
  }, [ariaLabel, editable, fontSize, lineHeight, lineWrapping, showLineNumbers])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const valueChanged = appliedValueRef.current !== value
    const currentSelection = view.state.selection.main
    const requestedSelection = selection ?? currentSelection
    const nextSelectionFrom = Math.max(0, Math.min(requestedSelection.from, value.length))
    const nextSelectionTo = Math.max(
      nextSelectionFrom,
      Math.min(requestedSelection.to, value.length)
    )
    const selectionChanged = (
      currentSelection.from !== nextSelectionFrom
      || currentSelection.to !== nextSelectionTo
    )
    if (!valueChanged && !selectionChanged) return

    if (!valueChanged) {
      view.dispatch({ selection: { anchor: nextSelectionFrom, head: nextSelectionTo } })
      return
    }

    const currentLength = view.state.doc.length
    isApplyingExternalValueRef.current = true
    try {
      view.dispatch({
        changes: { from: 0, to: currentLength, insert: value },
        selection: { anchor: nextSelectionFrom, head: nextSelectionTo },
        annotations: Transaction.addToHistory.of(false),
      })
      appliedValueRef.current = value
    } finally {
      isApplyingExternalValueRef.current = false
    }
  }, [selection, value])

  return (
    <div
      ref={containerRef}
      className={cn('h-full min-h-0 w-full overflow-hidden', className)}
    />
  )
}
