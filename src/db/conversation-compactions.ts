import { getDb } from './index'

export interface ConversationCompaction {
  id: number
  conversationId: number
  summary: string
  coveredThroughChatId: number
  tailStartChatId?: number
  sourceTokenCount: number
  summaryTokenCount: number
  model: string
  promptVersion: number
  revision: number
  createdAt: number
}

export type NewConversationCompaction = Omit<ConversationCompaction, 'id' | 'createdAt' | 'revision'>

export async function initConversationCompactionsDb() {
  const db = await getDb()
  await db.execute(`
    create table if not exists conversation_compactions (
      id integer primary key autoincrement,
      conversationId integer not null,
      summary text not null,
      coveredThroughChatId integer not null,
      tailStartChatId integer default null,
      sourceTokenCount integer not null,
      summaryTokenCount integer not null,
      model text not null,
      promptVersion integer not null,
      revision integer not null,
      createdAt integer not null
    )
  `)
  await db.execute(`
    create index if not exists idx_conversation_compactions_latest
    on conversation_compactions(conversationId, revision desc)
  `)
}

export async function getLatestConversationCompaction(
  conversationId: number
): Promise<ConversationCompaction | null> {
  const db = await getDb()
  const result = await db.select<ConversationCompaction[]>(
    `select * from conversation_compactions
     where conversationId = $1
     order by revision desc
     limit 1`,
    [conversationId]
  )
  return result[0] || null
}

export async function insertConversationCompaction(compaction: NewConversationCompaction) {
  const db = await getDb()
  const latest = await getLatestConversationCompaction(compaction.conversationId)
  const revision = (latest?.revision || 0) + 1
  const createdAt = Date.now()
  const result = await db.execute(
    `insert into conversation_compactions (
      conversationId,
      summary,
      coveredThroughChatId,
      tailStartChatId,
      sourceTokenCount,
      summaryTokenCount,
      model,
      promptVersion,
      revision,
      createdAt
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      compaction.conversationId,
      compaction.summary,
      compaction.coveredThroughChatId,
      compaction.tailStartChatId,
      compaction.sourceTokenCount,
      compaction.summaryTokenCount,
      compaction.model,
      compaction.promptVersion,
      revision,
      createdAt,
    ]
  )

  return {
    ...compaction,
    id: result.lastInsertId as number,
    revision,
    createdAt,
  } satisfies ConversationCompaction
}

export async function deleteConversationCompactions(conversationId: number) {
  const db = await getDb()
  await db.execute(
    'delete from conversation_compactions where conversationId = $1',
    [conversationId]
  )
}

export async function deleteAllConversationCompactions() {
  const db = await getDb()
  await db.execute('delete from conversation_compactions', [])
}
