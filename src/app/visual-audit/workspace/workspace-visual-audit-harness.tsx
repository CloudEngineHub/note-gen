'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

import MainPage from '@/app/core/main/page'
import { ThemeProvider } from '@/components/theme-provider'
import { TitleBar } from '@/components/title-bar'
import { TextSizeProvider } from '@/contexts/text-size-context'
import emitter from '@/lib/emitter'
import type { SkillContent } from '@/lib/skills/types'
import type { Mark } from '@/db/marks'
import type { Tag } from '@/db/tags'
import useArticleStore, { type DirTree } from '@/stores/article'
import useMarkStore from '@/stores/mark'
import useSettingStore from '@/stores/setting'
import { useSidebarStore } from '@/stores/sidebar'
import { useSkillsStore } from '@/stores/skills'
import useTagStore from '@/stores/tag'

const QA_ARTICLE_MARKDOWN = `# NoteGen 产品规划

> 用 AI 连接记录与写作，让碎片化信息变成可持续维护的笔记。

## 本次迭代目标

- 完善移动端记录体验
- 优化 Markdown 编辑与预览
- 统一桌面端和移动端同步状态

## 核心工作流

1. 快速记录文字、语音、图片和链接
2. 使用 AI 整理为结构化笔记
3. 继续编辑并同步到自己的工作区

### 视觉检查清单

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文件树 | 已完成 | 本地与远程状态清晰 |
| 编辑器 | 进行中 | 检查工具栏和正文间距 |
| AI 对话 | 待验证 | 覆盖输入框与权限模式 |

> [!NOTE]
> 所有页面都需要在桌面端和移动端完整展示。

\`\`\`ts
const workflow = ['记录', '整理', '写作']
\`\`\`

- [x] 页面结构
- [ ] 弹出菜单
- [ ] 深色模式
`

const QA_IMAGE_MARKDOWN = `# 图片编辑检查

点击图片后检查地址、替代文本、尺寸、重置和删除操作。

![NoteGen 应用图标](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzIwIDIwMCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiIHJ4PSIyNCIgZmlsbD0iI2Y0ZjRmNSIvPjxyZWN0IHg9IjI4IiB5PSIyOCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iMTgiIGZpbGw9IiMxODE4MWIiLz48cGF0aCBkPSJNNDggNDloMzJ2MzBINDh6TTU2IDQzdjEyTTcyIDQzdjEyIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjx0ZXh0IHg9IjI4IiB5PSIxNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMTgxODFiIj5Ob3RlR2VuPC90ZXh0Pjx0ZXh0IHg9IjI4IiB5PSIxNzQiIGZvbnQtZmFtaWx5PSJBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNzE3MTdhIj5WaXN1YWwgYXVkaXQgaW1hZ2U8L3RleHQ+PC9zdmc+)
`

const QA_RECORD_TAGS: Tag[] = [
  { id: 1, name: '收集箱', isLocked: true, isPin: true, sortOrder: 0, total: 5 },
  { id: 2, name: '产品', sortOrder: 1, total: 2 },
  { id: 3, name: '灵感', sortOrder: 2, total: 1 },
]

const QA_RECORD_MARKS: Mark[] = [
  {
    id: 101,
    tagId: 1,
    type: 'text',
    desc: '移动端回归检查',
    content: '重点检查抽屉、底部操作栏和键盘弹出后的布局。',
    url: '',
    deleted: 0,
    createdAt: 1785207600000,
  },
  {
    id: 102,
    tagId: 1,
    type: 'todo',
    desc: '发布前检查',
    content: '{"title":"发布前检查","description":"桌面端与移动端逐页核对","completed":false}',
    url: '',
    deleted: 0,
    createdAt: 1785121200000,
  },
  {
    id: 103,
    tagId: 1,
    type: 'link',
    desc: 'NoteGen 文档',
    content: '跨平台 Markdown 笔记应用',
    url: 'https://notegen.top',
    deleted: 0,
    createdAt: 1785034800000,
  },
  {
    id: 104,
    tagId: 1,
    type: 'recording',
    desc: '产品复盘录音',
    content: '今天讨论了视觉一致性、交互状态和发布前检查。',
    url: 'recordings/visual-audit.m4a',
    deleted: 0,
    createdAt: 1784948400000,
  },
  {
    id: 105,
    tagId: 1,
    type: 'image',
    desc: '界面问题截图',
    content: '设置页间距与原版不一致，需要继续调整。',
    url: 'image/visual-audit.png',
    deleted: 0,
    createdAt: 1784862000000,
  },
  {
    id: 201,
    tagId: 2,
    type: 'text',
    desc: 'NoteGen 产品规划',
    content: '用 AI 连接记录与写作，让碎片化信息变成可持续维护的笔记。',
    url: '',
    deleted: 0,
    createdAt: 1784775600000,
  },
  {
    id: 202,
    tagId: 2,
    type: 'file',
    desc: '发布检查表',
    content: '包含桌面端、移动端与弹出层检查项目。',
    url: '附件/发布检查表.pdf',
    deleted: 0,
    createdAt: 1784689200000,
  },
  {
    id: 301,
    tagId: 3,
    type: 'text',
    desc: '更克制的产品演示',
    content: '保持浅色、黑白、克制，让界面本身成为主角。',
    url: '',
    deleted: 0,
    createdAt: 1784602800000,
  },
]

function createQa002FileTree(): DirTree[] {
  const product: DirTree = {
    name: '产品',
    isDirectory: true,
    isFile: false,
    isSymlink: false,
    isLocale: true,
    children: [],
  }
  const project: DirTree = {
    name: '项目',
    isDirectory: true,
    isFile: false,
    isSymlink: false,
    isLocale: true,
    children: [product],
  }
  product.parent = project
  product.children = [
    {
      name: 'NoteGen 产品规划.md',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      isLocale: true,
      sha: 'qa-002-synced',
      parent: product,
    },
    {
      name: '移动端体验清单.md',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      isLocale: true,
      parent: product,
    },
  ]

  const archive: DirTree = {
    name: '归档',
    isDirectory: true,
    isFile: false,
    isSymlink: false,
    isLocale: true,
    children: [],
  }
  archive.children = [
    {
      name: '2026-07 发布记录.md',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      isLocale: false,
      sha: 'qa-002-remote',
      parent: archive,
    },
  ]

  return [
    project,
    {
      name: '收件箱.md',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      isLocale: true,
    },
    {
      name: 'README.md',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      isLocale: true,
      sha: 'qa-002-synced-readme',
    },
    archive,
  ]
}

function createQaImageFileTree(): DirTree[] {
  const tree = createQa002FileTree()
  const project = tree.find((item) => item.name === '项目')
  const product = project?.children?.find((item) => item.name === '产品')
  if (product) {
    product.children = [
      ...(product.children || []),
      {
        name: '视觉巡检.png',
        isDirectory: false,
        isFile: true,
        isSymlink: false,
        isLocale: true,
        parent: product,
      },
    ]
  }
  return tree
}

function createQaUnsupportedFileTree(): DirTree[] {
  const tree = createQa002FileTree()
  const project = tree.find((item) => item.name === '项目')
  const product = project?.children?.find((item) => item.name === '产品')
  if (product) {
    product.children = [
      ...(product.children || []),
      {
        name: '产品资料.zip',
        isDirectory: false,
        isFile: true,
        isSymlink: false,
        isLocale: true,
        parent: product,
      },
    ]
  }
  return tree
}

function createAuditSkills(): SkillContent[] {
  const now = Date.now()
  return [
    {
      metadata: {
        id: 'note-organizer',
        name: 'note-organizer',
        description: '把零散记录整理为结构清晰、可继续编辑的 Markdown 笔记。',
        scope: 'global',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      instructions: '分析输入记录，提取主题、事实和待办事项，并输出结构清晰的 Markdown 笔记。',
      scripts: [{ name: 'organize.py', path: 'scripts/organize.py', type: 'python', sha256: 'qa-audit', description: '整理记录' }],
      references: [{ name: 'style-guide.md', path: 'references/style-guide.md', description: '笔记格式规范' }],
      assets: [{ name: 'note-template.md', path: 'assets/note-template.md', type: 'template', description: '笔记模板' }],
    },
    {
      metadata: {
        id: 'daily-review',
        name: 'daily-review',
        description: '汇总当天新增内容，生成每日回顾和下一步行动。',
        scope: 'global',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      instructions: '汇总当天记录。',
      scripts: [],
      references: [],
      assets: [],
    },
    {
      metadata: {
        id: 'release-check',
        name: 'release-check',
        description: '检查当前工作区的发布记录、版本信息与遗漏事项。',
        scope: 'project',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      instructions: '检查发布准备情况。',
      scripts: [],
      references: [],
      assets: [],
    },
  ]
}

function createSkillsFileTree(): DirTree[] {
  const skills: DirTree = {
    name: 'skills',
    isDirectory: true,
    isFile: false,
    isSymlink: false,
    isLocale: true,
    children: [],
  }
  skills.children = createAuditSkills().map((skill) => ({
    name: skill.metadata.id,
    isDirectory: true,
    isFile: false,
    isSymlink: false,
    isLocale: true,
    parent: skills,
    children: [],
  }))
  return [skills]
}

export default function WorkspaceVisualAuditHarness() {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const stateId = new URLSearchParams(window.location.search).get('state')
    localStorage.setItem('leftSidebarVisible', 'true')
    localStorage.setItem('centerPanelVisible', 'true')
    localStorage.setItem('rightSidebarVisible', 'true')
    localStorage.setItem(
      'react-resizable-panels:main-layout:left-center-right',
      JSON.stringify([20, 50, 30]),
    )
    useSidebarStore.setState({
      leftSidebarVisible: true,
      centerPanelVisible: true,
      rightSidebarVisible: true,
      leftSidebarTab: 'files',
    })
    if (['qa-036', 'qa-037', 'qa-038', 'qa-039', 'qa-040', 'qa-041', 'qa-042', 'qa-043', 'qa-044', 'qa-045', 'qa-046'].includes(stateId || '')) {
      const recordViewMode = stateId === 'qa-037'
        ? 'compact'
        : stateId === 'qa-038'
          ? 'cards'
          : 'list'
      const selectedTag = ['qa-041', 'qa-042'].includes(stateId || '')
        ? QA_RECORD_TAGS[1]
        : QA_RECORD_TAGS[0]
      const detailMark = stateId === 'qa-043'
        ? QA_RECORD_MARKS.find((mark) => mark.id === 101)
        : stateId === 'qa-044'
          ? QA_RECORD_MARKS.find((mark) => mark.id === 104)
          : stateId === 'qa-045'
            ? {
                ...QA_RECORD_MARKS.find((mark) => mark.id === 105)!,
                url: 'http://localhost:3456/app-icon.png',
              }
            : stateId === 'qa-046'
              ? QA_RECORD_MARKS.find((mark) => mark.id === 103)
            : undefined
      const recordTab = detailMark
        ? {
            id: `record://mark/${detailMark.id}`,
            path: `record://mark/${detailMark.id}`,
            name: detailMark.desc || detailMark.content || detailMark.type,
            isFolder: false,
            kind: 'record' as const,
            markId: detailMark.id,
            markType: detailMark.type,
          }
        : undefined
      const auditMarks = detailMark && detailMark.id === 105
        ? QA_RECORD_MARKS.map((mark) => mark.id === detailMark.id ? detailMark : mark)
        : QA_RECORD_MARKS
      useSidebarStore.setState({ leftSidebarTab: 'notes' })
      useSettingStore.setState({ recordViewMode })
      useTagStore.setState({
        currentTagId: selectedTag.id,
        currentTag: selectedTag,
        tags: QA_RECORD_TAGS,
        fetchTags: async () => undefined,
        initTags: async () => undefined,
      })
      useMarkStore.setState({
        trashState: false,
        marks: auditMarks,
        allMarks: auditMarks,
        queues: [],
        activeMarkId: detailMark?.id || null,
        fetchMarks: async () => undefined,
      })
      useArticleStore.setState({
        activeFilePath: '',
        activeTabId: recordTab?.id || '',
        openTabs: recordTab ? [recordTab] : [],
        initOpenTabs: async () => undefined,
        initShowCloudFiles: async () => undefined,
      })
    } else if (['qa-012', 'qa-013'].includes(stateId || '')) {
      const auditSkills = createAuditSkills()
      useArticleStore.setState({
        fileTree: createSkillsFileTree(),
        fileTreeInitialized: true,
        fileTreeLoading: false,
        collapsibleList: ['skills'],
        collapsibleListInitialized: true,
        showCloudFiles: true,
        activeFilePath: '',
        selectedFilePaths: [],
      })
      useSkillsStore.setState({
        initialized: true,
        initializing: false,
        skills: auditSkills.map((skill) => skill.metadata),
        globalSkills: auditSkills.filter((skill) => skill.metadata.scope === 'global').map((skill) => skill.metadata),
        projectSkills: auditSkills.filter((skill) => skill.metadata.scope === 'project').map((skill) => skill.metadata),
        getSkillsByScope: (scope) => auditSkills.filter((skill) => skill.metadata.scope === scope),
      })
    } else if (['qa-002', 'qa-006', 'qa-007', 'qa-008', 'qa-009', 'qa-010', 'qa-011', 'qa-014', 'qa-015', 'qa-016', 'qa-017', 'qa-018', 'qa-019', 'qa-020', 'qa-021', 'qa-022', 'qa-023', 'qa-024', 'qa-025', 'qa-026', 'qa-027', 'qa-028', 'qa-029', 'qa-030', 'qa-031', 'qa-032', 'qa-033', 'qa-034', 'qa-035'].includes(stateId || '')) {
      const imageAudit = ['qa-032', 'qa-033'].includes(stateId || '')
      const unsupportedAudit = stateId === 'qa-034'
      const articlePath = imageAudit
        ? '项目/产品/视觉巡检.png'
        : unsupportedAudit
          ? '项目/产品/产品资料.zip'
          : '项目/产品/NoteGen 产品规划.md'
      const articleTab = {
        id: 'qa-014-note-tab',
        path: articlePath,
        name: imageAudit ? '视觉巡检.png' : unsupportedAudit ? '产品资料.zip' : 'NoteGen 产品规划.md',
        isFolder: false,
        kind: 'file' as const,
      }
      useArticleStore.setState({
        fileTree: imageAudit
          ? createQaImageFileTree()
          : unsupportedAudit
            ? createQaUnsupportedFileTree()
            : createQa002FileTree(),
        fileTreeInitialized: true,
        fileTreeLoading: false,
        collapsibleList: ['项目', '项目/产品', '归档'],
        collapsibleListInitialized: true,
        showCloudFiles: true,
        activeFilePath: '',
        selectedFilePaths: stateId === 'qa-010'
          ? ['项目/产品/NoteGen 产品规划.md', '收件箱.md']
          : [],
        ...(['qa-014', 'qa-015', 'qa-016', 'qa-017', 'qa-018', 'qa-019', 'qa-020', 'qa-021', 'qa-022', 'qa-023', 'qa-024', 'qa-025', 'qa-026', 'qa-027', 'qa-028', 'qa-029', 'qa-030', 'qa-031', 'qa-032', 'qa-033', 'qa-034', 'qa-035'].includes(stateId || '')
          ? {
              activeFilePath: articlePath,
              activeTabId: articleTab.id,
              openTabs: [articleTab],
              currentArticle: stateId === 'qa-025' ? QA_IMAGE_MARKDOWN : QA_ARTICLE_MARKDOWN,
              loading: false,
              initOpenTabs: async () => undefined,
              initShowCloudFiles: async () => undefined,
            }
          : {}),
      })
    }
    setReady(true)
  }, [])

  useEffect(() => {
    const stateId = new URLSearchParams(window.location.search).get('state')
    if (!ready || !['qa-003', 'qa-004', 'qa-005', 'qa-006', 'qa-007', 'qa-008', 'qa-009', 'qa-010', 'qa-011', 'qa-012', 'qa-013', 'qa-015', 'qa-016', 'qa-017', 'qa-018', 'qa-019', 'qa-035', 'qa-039', 'qa-040', 'qa-042'].includes(stateId || '')) {
      return
    }

    let actionCompleted = false
    let slashShortcutSent = false
    let textSelectionSent = false
    const openAuditMenu = () => {
      if (stateId === 'qa-015') {
        if (actionCompleted) {
          return
        }
        const sourceModeButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.getAttribute('aria-label') === 'Markdown 源码模式')
        if (sourceModeButton) {
          actionCompleted = true
          sourceModeButton.click()
        }
        return
      }

      if (stateId === 'qa-016') {
        if (actionCompleted) {
          return
        }
        const outlineButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === '大纲')
        if (outlineButton) {
          actionCompleted = true
          outlineButton.click()
        }
        return
      }

      if (stateId === 'qa-017') {
        const searchInput = Array.from(document.querySelectorAll<HTMLInputElement>('input'))
          .find((input) => input.placeholder === '搜索...')
        if (!searchInput) {
          emitter.emit('editor-search-trigger' as never)
          return
        }
        if (searchInput.value !== 'NoteGen') {
          const valueSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )?.set
          valueSetter?.call(searchInput, 'NoteGen')
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }
        actionCompleted = true
        return
      }

      if (stateId === 'qa-018') {
        if (document.body.textContent?.includes('自定义指令')) {
          actionCompleted = true
          return
        }
        if (!slashShortcutSent && document.querySelector('.ProseMirror')) {
          slashShortcutSent = true
          window.setTimeout(() => {
            document.dispatchEvent(new CustomEvent('visual-audit-open-slash-command'))
          }, 8000)
        }
        return
      }

      if (stateId === 'qa-019') {
        if (!textSelectionSent && document.querySelector('.ProseMirror')) {
          textSelectionSent = true
          window.setTimeout(() => {
            document.dispatchEvent(new CustomEvent('visual-audit-select-text'))
          }, 1500)
        }
        return
      }

      if (stateId === 'qa-035') {
        if (document.querySelector('[role="menu"]')) {
          actionCompleted = true
          return
        }
        const tab = document.querySelector<HTMLElement>('[data-tab-id]')
        if (tab) {
          const rect = tab.getBoundingClientRect()
          tab.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true,
            button: 2,
            clientX: rect.left + rect.width / 2,
            clientY: rect.bottom - 4,
          }))
        }
        return
      }

      if (stateId === 'qa-039') {
        if (document.querySelector('#record-filter-search')) {
          actionCompleted = true
          return
        }
        document.querySelector<HTMLButtonElement>('button[aria-label="筛选"]')?.click()
        return
      }

      if (stateId === 'qa-040') {
        if (actionCompleted) {
          return
        }
        const moreButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label="更多"]'))
        if (moreButtons[1]) {
          actionCompleted = true
          moreButtons[1].dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            pointerType: 'mouse',
          }))
        }
        return
      }

      if (stateId === 'qa-042') {
        if (document.querySelector('input[placeholder="请输入标签名称"]')) {
          actionCompleted = true
          return
        }
        document.querySelector<HTMLButtonElement>('button[aria-label="新建标签"]')?.click()
        return
      }

      if (['qa-011', 'qa-012', 'qa-013'].includes(stateId || '')) {
        if (actionCompleted) {
          return
        }
        const targetLabel = stateId === 'qa-011'
          ? '项目'
          : stateId === 'qa-012'
            ? 'skills'
            : 'note-organizer'
        const projectLabel = Array.from(document.querySelectorAll<HTMLElement>('*'))
          .find((element) => element.children.length === 0 && element.textContent?.trim() === targetLabel)
        if (projectLabel) {
          actionCompleted = true
          projectLabel.click()
        }
        return
      }

      if (['qa-006', 'qa-007', 'qa-008', 'qa-009', 'qa-010'].includes(stateId || '')) {
        if (actionCompleted) {
          return
        }
        const openMenu = document.querySelector('[role="menu"]')
        if (['qa-007', 'qa-008', 'qa-009'].includes(stateId || '') && openMenu) {
          const targetLabel = stateId === 'qa-007'
            ? '新建文件'
            : stateId === 'qa-008'
              ? '新建文件夹'
              : '重命名F2'
          const createItem = Array.from(openMenu.querySelectorAll<HTMLElement>('[role="menuitem"]'))
            .find((item) => item.textContent?.trim() === targetLabel)
          if (createItem) {
            actionCompleted = true
            createItem.click()
          }
          return
        }
        const targetEntryLabel = stateId === 'qa-009' || stateId === 'qa-010'
          ? 'NoteGen 产品规划.md'
          : '项目'
        const folderLabel = Array.from(document.querySelectorAll<HTMLElement>('*'))
          .find((element) => element.children.length === 0 && element.textContent?.trim() === targetEntryLabel)
        if (!openMenu) {
          folderLabel?.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true,
            button: 2,
          }))
        }
        return
      }

      const target = stateId === 'qa-003'
        ? Array.from(document.querySelectorAll('button'))
            .find((button) => button.textContent?.includes('默认工作区'))
        : document.querySelector<HTMLButtonElement>('button[aria-label="更多"]')
      if (target?.getAttribute('aria-expanded') !== 'true') {
        target?.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          pointerType: 'mouse',
        }))
        return
      }

      if (stateId === 'qa-005') {
        const sortItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
          .find((item) => item.textContent?.trim() === '排序')
        sortItem?.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
        }))
      }
    }
    const timer = window.setInterval(openAuditMenu, 100)
    openAuditMenu()

    return () => window.clearInterval(timer)
  }, [ready])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TextSizeProvider>
        <div className="h-screen w-screen overflow-hidden bg-background">
          <TitleBar
            onSearchClick={() => undefined}
            onActivityClick={() => undefined}
            activityOpen={false}
          />
          <main className="mt-9 h-[calc(100vh-36px)] w-full overflow-hidden">
            {ready ? <MainPage /> : null}
          </main>
        </div>
      </TextSizeProvider>
    </ThemeProvider>
  )
}
