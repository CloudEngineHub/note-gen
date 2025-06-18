import { Button } from "@/components/ui/button";
import { DownloadCloud, Loader2, UploadCloud } from "lucide-react";
import { readFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
import { RepoNames } from "@/lib/github.types";
import { uint8ArrayToBase64, uploadFile, getFiles, decodeBase64ToString } from "@/lib/github";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { isMobileDevice } from "@/lib/check";
import { relaunch } from "@tauri-apps/plugin-process";

export default function UploadStore() {
  const [upLoading, setUploading] = useState(false)
  const [downLoading, setDownLoading] = useState(false)

  async function upload() {
    setUploading(true)
    const path = '.settings'
    const filename = 'store.json'
    const file = await readFile('store.json', { baseDir: BaseDirectory.AppData });
    const store = await Store.load('store.json');
    const primaryBackupMethod = await store.get('primaryBackupMethod')
    if (primaryBackupMethod === 'github') {
      const files = await getFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
      const res = await uploadFile({
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
    setDownLoading(true)
    const path = '.settings'
    const filename = 'store.json'
    const file = await getFiles({ path: `${path}/${filename}`, repo: RepoNames.sync })
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
    <div className="flex gap-1 flex-col border-t p-2">
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