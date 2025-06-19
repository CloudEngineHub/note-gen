import { Button } from "@/components/ui/button"
import { Chat } from "@/db/chats"
import { insertMark } from "@/db/marks"
import useChatStore from "@/stores/chat"
import useMarkStore from "@/stores/mark"
import useTagStore from "@/stores/tag"
import { CheckCircle, Highlighter } from "lucide-react"
import { useTranslations } from "next-intl"

export function MarkText({chat}: {chat: Chat}) {

  const { currentTagId, fetchTags, getCurrentTag } = useTagStore()
  const { fetchMarks } = useMarkStore()
  const { updateInsert, chats } = useChatStore()
  const t = useTranslations('record.chat')

  async function handleSuccess() {
    const currentIndex = chats.findIndex(item => item.id === chat.id)
    const prevChat = chats[currentIndex - 1]
    const res = `
${prevChat?.content}
${chat.content}
`
    const resetText = res.replace(/'/g, '')
    await insertMark({ tagId: currentTagId, type: 'text', desc: resetText, content: resetText })
    updateInsert(chat.id)
    await fetchMarks()
    await fetchTags()
    getCurrentTag()
  }

  return (
    chat.inserted ? 
      <Button variant={"ghost"} size="sm" disabled>
        <CheckCircle className="size-4" />
        <span className="hidden lg:inline">{t('mark.recorded')}</span>
      </Button> :
      <Button variant={"ghost"} size="sm" onClick={handleSuccess}>
        <Highlighter className="size-4" />
        <span className="hidden lg:inline">{t('mark.record')}</span>
      </Button>
  )
}