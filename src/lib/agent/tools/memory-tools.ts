import { Tool, ToolResult } from '../types'
import { upsertMemory, getAllMemories, getMemoriesByCategory, deleteMemory, clearAllMemories, Memory } from '@/db/memories'
import { fetchEmbedding } from '@/lib/ai/embedding'

/**
 * Tool: List all memories
 */
export const listMemoriesTool: Tool = {
  name: 'list_memories',
  description: `Query all saved memories (preferences and memory).

Use cases:
- Before adding a new memory, use this tool to check existing memories
- Check for conflicting memories (e.g., existing "answer in Chinese" vs new "answer in English")
- Get memory IDs for delete operations

Returns memory ID, content, and type (preference/memory).`,
  category: 'system',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'category',
      type: 'string',
      description: 'Optional: Filter memory type (preference or memory)',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      let memories: Memory[]
      if (params.category) {
        memories = await getMemoriesByCategory(params.category as 'preference' | 'memory')
      } else {
        memories = await getAllMemories()
      }

      const formatted = memories.map(m =>
        `ID: ${m.id} [${m.category === 'preference' ? 'Preference' : 'Memory'}] ${m.content}`
      ).join('\n')

      return {
        success: true,
        message: `Found ${memories.length} memories:\n${formatted}`,
      }
    } catch {
      return {
        success: false,
        error: `Failed to get memory list`,
      }
    }
  },
}

/**
 * Tool: Delete a specific memory
 */
export const deleteMemoryTool: Tool = {
  name: 'delete_memory',
  description: `Delete one saved memory by ID when the user explicitly asks to remove it.

Deletion is complete on its own. Save a replacement only when the user separately and explicitly asks to remember replacement information.`,
  category: 'system',
  requiresConfirmation: true,
  parameters: [
    {
      name: 'id',
      type: 'string',
      description: 'Memory ID (from list_memories result)',
      required: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const memories = await getAllMemories()
      if (!memories.some(memory => memory.id === params.id)) {
        return {
          success: true,
          data: { id: params.id, alreadyAbsent: true },
          message: `Memory already absent`,
        }
      }
      await deleteMemory(params.id)
      return {
        success: true,
        data: { id: params.id, alreadyAbsent: false },
        message: `Memory deleted`,
      }
    } catch {
      return {
        success: false,
        error: `Failed to delete memory`,
      }
    }
  },
}

/**
 * Tool: Save or update memory
 */
export const saveMemoryTool: Tool = {
  name: 'save_memory',
  description: `Save or update a memory only when the user expresses clear persistent intent, such as explicitly asking NoteGen to remember something for future conversations.

Do not persist one-turn instructions merely because they mention a language, format, tone, or temporary preference. If a persistent request conflicts with an existing memory, inspect existing memories and update only what the user asked to change.

Supports two types:
- preference: User preferences like language, format, style - always included in conversations
- memory: User's facts, experience, expertise - matched intelligently via context

Examples:
- "Remember that I prefer concise English answers in future conversations" -> preference
- "Remember that I maintain a React library" -> memory
- "Answer this message in English" -> do not save`,
  category: 'system',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'Content to remember',
      required: true,
    },
    {
      name: 'category',
      type: 'string',
      description: 'Memory type: preference (user settings) or memory (facts/expertise). Auto-detected if not specified',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      // Calculate embedding
      const embedding = await fetchEmbedding(params.content)
      if (!embedding) {
        return {
          success: false,
          error: 'Cannot generate vector embedding, please check embedding model configuration',
        }
      }

      // Save memory
      const result = await upsertMemory({
        content: params.content,
        embedding: JSON.stringify(embedding),
        category: params.category as 'preference' | 'memory' || undefined,
      })

      if (result.replaced) {
        return {
          success: true,
          data: { replaced: true },
          message: `Memory updated (similar memory replaced)`,
        }
      }

      return {
        success: true,
        data: { replaced: false },
        message: `Memory saved`,
      }
    } catch {
      return {
        success: false,
        error: `Failed to save memory`,
      }
    }
  },
}

/**
 * Tool: Clear all memories
 */
export const clearMemoriesTool: Tool = {
  name: 'clear_all_memories',
  description: `Clear all memories.

Use cases:
- When user explicitly requests to clear all memories
- Reset all memory data

WARNING: This operation is irreversible, use with caution`,
  category: 'system',
  requiresConfirmation: true,
  parameters: [],
  execute: async (): Promise<ToolResult> => {
    try {
      const memories = await getAllMemories()
      if (memories.length === 0) {
        return {
          success: true,
          data: { scope: 'all', alreadyAbsent: true },
          message: `All memories are already cleared`,
        }
      }
      await clearAllMemories()
      return {
        success: true,
        data: { scope: 'all', alreadyAbsent: false },
        message: `All memories cleared`,
      }
    } catch {
      return {
        success: false,
        error: `Failed to clear memories`,
      }
    }
  },
}

export const memoryTools: Tool[] = [
  saveMemoryTool,
  listMemoriesTool,
  deleteMemoryTool,
  clearMemoriesTool,
]
