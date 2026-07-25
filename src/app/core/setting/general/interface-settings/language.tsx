'use client'

import { useTranslations } from 'next-intl'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'
import { Languages } from 'lucide-react'
import { useI18n } from "@/hooks/useI18n"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function LanguageSettings() {
  const t = useTranslations('settings.general.interface')
  const { currentLocale, changeLanguage } = useI18n()

  const getLanguageDisplay = (locale: string) => {
    switch (locale) {
      case "en":
        return "English"
      case "zh":
        return "中文"
      case "zh-TW":
        return "繁體中文"
      case "pt-BR":
        return "Português"
      case "ja":
        return "日本語"
      default:
        return "中文"
    }
  }

  return (
    <Item variant="outline">
      <ItemMedia variant="icon"><Languages /></ItemMedia>
      <ItemContent>
        <ItemTitle>{t('language.title')}</ItemTitle>
        <ItemDescription>{t('language.desc')}</ItemDescription>
      </ItemContent>
      <ItemActions className="basis-full sm:ml-auto sm:basis-auto">
        <Select value={currentLocale} onValueChange={changeLanguage}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span>{getLanguageDisplay(currentLocale)}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="zh-TW">繁體中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="pt-BR">Português</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </ItemActions>
    </Item>
  )
}
