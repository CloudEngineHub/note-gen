import { getFiles, GithubFile } from '@/lib/github';
import { GithubRepoInfo, OctokitResponse, RepoNames, SyncStateEnum, UserInfo } from '@/lib/github.types';
import { Store } from '@tauri-apps/plugin-store';
import { create } from 'zustand'

interface MarkState {
  path: string
  setPath: (path: string) => void

  images: GithubFile[]
  pushImage: (image: GithubFile) => void
  deleteImage: (name: string) => void
  getImages: () => Promise<void>

  // 图床 Github 仓库
  imageRepoUserInfo?: OctokitResponse<UserInfo>
  setImageRepoUserInfo: (imageRepoUserInfo?: OctokitResponse<UserInfo>) => Promise<void>
  imageRepoState: SyncStateEnum
  setImageRepoState: (imageRepoState: SyncStateEnum) => void
  imageRepoInfo?: GithubRepoInfo
  setImageRepoInfo: (imageRepoInfo?: GithubRepoInfo) => void
}

const useImageStore = create<MarkState>((set, get) => ({
  path: '',
  setPath: (path) => set({ path }),

  images: [],

  pushImage: (image) => {
    set(state => ({
      images: [image, ...state.images]
    }))
  },
  deleteImage: (name) => {
    set(state => ({
      images: state.images.filter(item => item.name !== name)
    }))
  },
  async getImages() {
    set({ images: [] })
    const images = await getFiles({ path: get().path, repo: RepoNames.image })
    set({ images: images || [] })
  },

  imageRepoUserInfo: undefined,
  setImageRepoUserInfo: async (imageRepoUserInfo) => {
    set({ imageRepoUserInfo })
    if (!imageRepoUserInfo) return
    const store = await Store.load('store.json');
    await store.set('githubImageUsername', imageRepoUserInfo?.data?.login)
    await store.save()
  },
  imageRepoState: SyncStateEnum.fail,
  setImageRepoState: (imageRepoState) => {
    set({ imageRepoState })
  },
  imageRepoInfo: undefined,
  setImageRepoInfo: (imageRepoInfo) => {
    set({ imageRepoInfo })
  },
}))

export default useImageStore