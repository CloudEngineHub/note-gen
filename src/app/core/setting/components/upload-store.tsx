import { Button } from "@/components/ui/button";
import { DownloadCloud, Loader2, UploadCloud } from "lucide-react";
import { readFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
import { RepoNames } from "@/lib/github.types";
import { uint8ArrayToBase64, uploadFile as uploadGithubFile, getFiles as githubGetFiles, decodeBase64ToString } from "@/lib/github";
import { getFiles as giteeGetFiles, uploadFile as uploadGiteeFile } from "@/lib/gitee";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { isMobileDevice } from "@/lib/check";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirm } from "@tauri-apps/plugin-dialog";

export default function UploadStore() {
  const [upLoading, setUploading] = useState(false)
  const [downLoading, setDownLoading] = useState(false)

  async function upload() {
    const res = await confirm('上传配置请确保同步仓库为私有，否则数据将会泄露！')
    if (!res) return
    setUploading(true)
    const path = '.settings'
    const filename = 'store.json'
    const file = await readFile('store.json', { baseDir: BaseDirectory.AppData });
    const store = await Store.load('store.json');
    const primaryBackupMethod = await store.get('primaryBackupMethod')
    if (primaryBackupMethod === 'github') {
      const files = await githubGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      const res = await uploadGithubFile({
        ext: 'json',
        file: uint8ArrayToBase64(file),
        repo: RepoNames.sync,
        path,
        filename,
        sha: files?.sha,
      })
      if (res) {
        toast({
          title: '上传成功',
          description: '配置已成功上传',
        })
      }
    } else if (primaryBackupMethod === 'gitee') {
      const files = await giteeGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      const res = await uploadGiteeFile({
        ext: 'json',
        file: uint8ArrayToBase64(file),
        repo: RepoNames.sync,
        path,
        filename,
        sha: files?.sha,
      })
      if (res) {
        toast({
          title: '上传成功',
          description: '配置已成功上传',
        })
      }
    }
    setUploading(false)
  }

  async function download() {
    const res = await confirm('下载配置将会覆盖本地配置，并且重启生效！')
    if (!res) return
    setDownLoading(true)
    const path = '.settings'
    const filename = 'store.json'
    const store = await Store.load('store.json');
    const primaryBackupMethod = await store.get('primaryBackupMethod')
    let file;
    if (primaryBackupMethod === 'github') {
      file = await githubGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
    } else if (primaryBackupMethod === 'gitee') {
      file = await giteeGetFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
    }
    if (file) {
      const configJson = decodeBase64ToString(file.content)
      const store = await Store.load('store.json');
      Object.keys(JSON.parse(configJson)).forEach(key => {
        store.set(key, JSON.parse(configJson)[key])
      })
      if (isMobileDevice()) {
        toast({
          description: '配置下载成功，请手动重启应用',
        })
      } else {
        relaunch()
      }
    }
    setDownLoading(false)
  }

  return (
    <div className="flex gap-1 flex-col border-t justify-center items-center">
      <div className="flex gap-2">
        <Button variant={'ghost'} size={'sm'} onClick={upload} disabled={upLoading}>
          {upLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud />}
          <span>上传配置</span>
        </Button>
        <Button variant={'ghost'} size={'sm'} onClick={download} disabled={downLoading}>
          {downLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud />}
          <span>下载配置</span>
        </Button>
      </div>
    </div>
  )
}