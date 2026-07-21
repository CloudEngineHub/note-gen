import { useTranslations } from 'next-intl';
import { RefreshCw, Trash, FileText, Layers, Hash, Target, ListFilter, Shield } from "lucide-react";
import useRagSettingsStore from "@/stores/ragSettings";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemActions, ItemDescription, ItemFooter } from '@/components/ui/item';
import { clearVectorDb, initVectorDb } from "@/db/vector";
import { toast } from "@/hooks/use-toast";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Field, FieldTitle } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function Settings() {
  const t = useTranslations('settings.rag');
  
  const { 
    chunkSize, 
    chunkOverlap, 
    resultCount, 
    similarityThreshold,
    rerankThreshold,
    excludedPaths,
    initSettings,
    updateSetting,
    resetToDefaults
  } = useRagSettingsStore();

  useEffect(() => {
    initSettings();
  }, []);

  function handleDeleteVector() {
    confirm(t('deleteVectorConfirm')).then(async (result) => {
      if (result) {
        await clearVectorDb()
        await initVectorDb()
        toast({
          title: t('deleteVectorSuccess'),
          variant: 'default',
        })
      }
    })
  }

  const settings = [
    {
      title: t('chunkSize'),
      desc: t('chunkSizeDesc'),
      value: chunkSize,
      min: 100,
      max: 5000,
      step: 100,
      icon: FileText,
      onChange: (value: number) => updateSetting('chunkSize', value)
    },
    {
      title: t('chunkOverlap'),
      desc: t('chunkOverlapDesc'),
      value: chunkOverlap,
      min: 0,
      max: 500,
      step: 50,
      icon: Layers,
      onChange: (value: number) => updateSetting('chunkOverlap', value)
    },
    {
      title: t('resultCount'),
      desc: t('resultCountDesc'),
      value: resultCount,
      min: 1,
      max: 10,
      step: 1,
      icon: Hash,
      onChange: (value: number) => updateSetting('resultCount', value)
    },
    {
      title: t('similarityThreshold'),
      desc: t('similarityThresholdDesc'),
      value: similarityThreshold,
      min: 0,
      max: 1,
      step: 0.01,
      icon: Target,
      onChange: (value: number) => updateSetting('similarityThreshold', value)
    },
    {
      title: t('rerankThreshold'),
      desc: t('rerankThresholdDesc'),
      value: rerankThreshold,
      min: 0,
      max: 1,
      step: 0.01,
      icon: ListFilter,
      onChange: (value: number) => updateSetting('rerankThreshold', value)
    }
  ]

  return (
    <>
      <Field>
        <FieldTitle>{t('settingsTitle')}</FieldTitle>
        <ItemGroup className="gap-4">
          {settings.map((setting) => {
            const Icon = setting.icon
            return (
            <Item key={setting.title} className="max-md:flex-col max-md:items-start" variant="outline">
              <ItemMedia variant="icon">
                <Icon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{setting.title}</ItemTitle>
                <ItemDescription>{setting.desc}</ItemDescription>
              </ItemContent>
              <ItemActions className="w-[180px] max-md:w-full">
                <div className="space-y-3 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{setting.min}</span>
                    <span className="text-xs font-medium">{setting.value}</span>
                    <span className="text-xs text-muted-foreground">{setting.max}</span>
                  </div>
                  <Slider
                    value={[setting.value]}
                    onValueChange={(value) => setting.onChange(value[0])}
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    className="w-full"
                  />
                </div>
              </ItemActions>
            </Item>
          )
          })}
        </ItemGroup>
      </Field>
      <Field className="mt-4">
        <FieldTitle>{t('excludedPaths')}</FieldTitle>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Shield className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t('excludedPaths')}</ItemTitle>
            <ItemDescription>{t('excludedPathsDesc')}</ItemDescription>
          </ItemContent>
          <ItemFooter className="w-full">
            <Textarea
              key={excludedPaths.join('\n')}
              defaultValue={excludedPaths.join('\n')}
              placeholder={t('excludedPathsPlaceholder')}
              className="min-h-24 font-mono text-xs"
              onBlur={(event) => updateSetting(
                'excludedPaths',
                event.currentTarget.value.split(/[\n,]/).map(path => path.trim()).filter(Boolean)
              )}
            />
          </ItemFooter>
        </Item>
      </Field>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="size-4 mr-2" /> {t('resetToDefaults')}
        </Button>
        <Button variant="destructive" onClick={handleDeleteVector}>
          <Trash className="size-4 mr-2" /> {t('deleteVector')}
        </Button>
      </div>
    </>
  );
}
