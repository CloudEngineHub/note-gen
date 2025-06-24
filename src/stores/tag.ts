import { Tag, delTag, getTags, insertTags, deleteAllTags } from '@/db/tags'
import { uploadFile as uploadGithubFile, getFiles as githubGetFiles, decodeBase64ToString } from '@/lib/github';
import { uploadFile as uploadGiteeFile, getFiles as giteeGetFiles } from '@/lib/gitee';
import { RepoNames } from '@/lib/github.types';
import { Store } from '@tauri-apps/plugin-store'
import { create } from 'zustand'

interface TagState {
  currentTagId: number
  setCurrentTagId: (id: number) => Promise<void>
  initTags: () => Promise<void>

  currentTag?: Tag
  getCurrentTag: () => void

  tags: Tag[]
  fetchTags: () => Promise<void>

  deleteTag: (id: number) => Promise<void>

  // 同步
  syncState: boolean
  setSyncState: (syncState: boolean) => void
  lastSyncTime: string
  setLastSyncTime: (lastSyncTime: string) => void
  uploadTags: () => Promise<boolean>
  downloadTags: () => Promise<Tag[]>
}

const useTagStore = create<TagState>((set, get) => ({
  // 当前选择的 tag
  currentTagId: 1,
  setCurrentTagId: async(currentTagId: number) => {
    set({ currentTagId })
    const store = await Store.load('store.json');
    await store.set('currentTagId', currentTagId)
  },
  initTags: async () => {
    const store = await Store.load('store.json');
    const currentTagId = await store.get<number>('currentTagId')
    if (currentTagId) set({ currentTagId })
    get().getCurrentTag()
  },

  currentTag: undefined,
  getCurrentTag: () => {
    const tags = get().tags
    const getcurrentTagId = get().currentTagId
    const currentTag = tags.find((tag) => tag.id === getcurrentTagId)
    if (currentTag) {
      set({ currentTag })
    }
  },

  // 所有 tag
  tags: [],
  fetchTags: async () => {
    const tags = await getTags()
    set({ tags })
  },

  deleteTag: async (id: number) => {
    await delTag(id)
    await get().fetchTags()
    await get().setCurrentTagId(get().tags[0].id)
  },

  // 同步
  syncState: false,
  setSyncState: (syncState) => {
    set({ syncState })
  },
  lastSyncTime: '',
  setLastSyncTime: (lastSyncTime) => {
    set({ lastSyncTime })
  },
  uploadTags: async () => {
    set({ syncState: true })
    const path = '.data'
    const filename = 'tags.json'
    const tags = await getTags()
    const store = await Store.load('store.json');
    const jsonToBase64 = (data: Tag[]) => {
      return Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    }
    const primaryBackupMethod = await store.get<string>('primaryBackupMethod') || 'github';
    let result = false
    if (primaryBackupMethod === 'github') {
      const files = await githubGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      const res = await uploadGithubFile({
        ext: 'json',
        file: jsonToBase64(tags),
        repo: RepoNames.sync,
        path,
        filename,
        sha: files?.sha,
      })
      if (res) {
        result = true
      }
    } else if (primaryBackupMethod === 'gitee') {
      const files = await giteeGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      const res = await uploadGiteeFile({
        ext: 'json',
        file: jsonToBase64(tags),
        repo: RepoNames.sync,
        path,
        filename,
        sha: files?.sha,
      })
      if (res) {
        result = true
      }
    }
    set({ syncState: false })
    return result
  },
  downloadTags: async () => {
    const path = '.data'
    const filename = 'tags.json'
    const store = await Store.load('store.json');
    const primaryBackupMethod = await store.get<string>('primaryBackupMethod') || 'github';
    let result = []
    if (primaryBackupMethod === 'github') {
      const file = await githubGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      if (file) {
        const configJson = decodeBase64ToString(file.content)
        result = JSON.parse(configJson)
      }
    } else if (primaryBackupMethod === 'gitee') {
      const file = await giteeGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      if (file) {
        const configJson = decodeBase64ToString(file.content)
        result = JSON.parse(configJson)
      }
    }
    await deleteAllTags()
    await insertTags(result)
    set({ syncState: false })
    return result
  },
}))

export default useTagStore