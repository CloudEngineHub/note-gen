import { Button } from "@/components/ui/button";
import { SettingRow } from "../components/setting-base";
import { HardDriveDownload, HardDriveUpload } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useToast } from "@/hooks/use-toast";
import { BaseDirectory, copyFile, readTextFile } from "@tauri-apps/plugin-fs";
import { Store } from "@tauri-apps/plugin-store";

export default function SetConfig() {
    const { toast } = useToast()
    async function handleImport() {
      const file = await open({
        title: '导入配置文件',
      })
      if (file) {
        const content = await readTextFile(file, { baseDir: BaseDirectory.AppData })
        const jsonContent = JSON.parse(content)
        const store = await Store.load('store.json');
        Object.keys(jsonContent).forEach((key: string) => {
          store.set(key, jsonContent[key])
        })
        toast({ title: '导入成功' })
      }
    }
    async function handleExport() {
      const file = await save({
        title: '导出配置文件',
        defaultPath: 'store.json',
      })
      if (file) {
        await copyFile('store.json', file, { fromPathBaseDir: BaseDirectory.AppData })
        toast({ title: '导出成功' })
      }
    }
    return (
    <SettingRow border className="gap-4 flex-col lg:flex-row !items-start lg:items-center">
      <span>配置文件导入与导出，导入配置文件将覆盖当前配置，并且重启后生效。</span>
      <div className="flex gap-2">
        <Button onClick={handleImport}><HardDriveDownload />导入</Button>
        <Button onClick={handleExport}><HardDriveUpload />导出</Button>
      </div>
    </SettingRow>
  )
}