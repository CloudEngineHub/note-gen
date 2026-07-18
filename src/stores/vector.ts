import { create } from 'zustand';
import { initVectorDb, processAllMarkdownFiles, processMarkdownFile, checkEmbeddingModelAvailable, initBM25Search } from '@/lib/rag';
import { checkRerankModelAvailable } from '@/lib/ai/embedding';
import { Store } from "@tauri-apps/plugin-store";
import { toast } from '@/hooks/use-toast';

interface VectorState {
  isRagEnabled: boolean;           // 是否启用RAG检索功能
  isAutoVectorEnabled: boolean;    // 是否在文件保存后自动更新向量
  isProcessing: boolean;           // 是否正在处理向量
  lastProcessTime: number | null;  // 最后一次处理向量的时间
  hasRerankModel: boolean;         // 是否有可用的重排序模型

  // 统计数据
  documentCount: number;           // 文档数量

  // 初始化函数
  initVectorDb: () => Promise<void>;

  // RAG启用/禁用
  setRagEnabled: (enabled: boolean) => Promise<void>;
  setAutoVectorEnabled: (enabled: boolean) => Promise<void>;

  // 处理向量
  processAllDocuments: () => Promise<void>;
  processDocument: (filename: string, content: string) => Promise<void>;
  checkEmbeddingModel: () => Promise<boolean>;
  checkRerankModel: () => Promise<boolean>;
}

const useVectorStore = create<VectorState>((set, get) => ({
  isRagEnabled: false,
  isAutoVectorEnabled: true,
  isProcessing: false,
  lastProcessTime: null,
  hasRerankModel: false,
  documentCount: 0,

  // 初始化向量数据库
  initVectorDb: async () => {
    try {
      await initVectorDb();

      // 初始化 BM25 索引
      await initBM25Search();

      // 读取用户设置
      const store = await Store.load('store.json');
      const isRagEnabled = await store.get<boolean>('isRagEnabled') || false;
      const isAutoVectorEnabled = await store.get<boolean>('autoVectorEnabled') ?? true;
      const lastProcessTime = await store.get<number>('lastVectorProcessTime') || null;

      set({
        isRagEnabled,
        isAutoVectorEnabled,
        lastProcessTime
      });

      // 检查嵌入模型可用性
      if (isAutoVectorEnabled || isRagEnabled) {
        const modelAvailable = await get().checkEmbeddingModel();
        if (!modelAvailable) {
          toast({
            title: '向量数据库',
            description: '未配置嵌入模型或模型不可用，请在AI设置中配置嵌入模型',
            variant: 'destructive',
          });
        }
      }

      // 检查重排序模型是否可用
      const hasRerankModel = await get().checkRerankModel();
      set({ hasRerankModel });
    } catch (error) {
      console.error('初始化向量数据库失败:', error);
    }
  },

  // 设置RAG启用状态
  setRagEnabled: async (enabled: boolean) => {
    try {
      const store = await Store.load('store.json');
      await store.set('isRagEnabled', enabled);

      set({ isRagEnabled: enabled });
    } catch (error) {
      console.error('设置RAG状态失败:', error);
    }
  },

  setAutoVectorEnabled: async (enabled: boolean) => {
    const store = await Store.load('store.json');
    await store.set('autoVectorEnabled', enabled);
    set({ isAutoVectorEnabled: enabled });
  },

  // 处理所有文档向量
  processAllDocuments: async () => {
    // 如果已经在处理中，直接返回
    if (get().isProcessing) return;

    let processingToast: ReturnType<typeof toast> | undefined;

    try {
      // 检查嵌入模型是否可用
      const modelAvailable = await get().checkEmbeddingModel();
      if (!modelAvailable) {
        toast({
          title: '向量处理',
          description: '未配置嵌入模型或模型不可用，请在AI设置中配置嵌入模型',
          variant: 'destructive',
        });
        return;
      }

      // 设置处理状态
      set({ isProcessing: true });

      // 显示处理开始的提示
      processingToast = toast({
        title: '向量处理',
        description: '开始处理文档向量，这可能需要一些时间...',
        duration: Infinity,
      });

      // 处理所有文档，带进度回调
      const result = await processAllMarkdownFiles((current, total, fileName) => {
        processingToast?.update({
          title: '向量处理中',
          description: `已处理 ${current}/${total}：${fileName}`,
          duration: Infinity,
        });
      });

      // 更新处理时间和状态
      const currentTime = Date.now();
      const store = await Store.load('store.json');
      await store.set('lastVectorProcessTime', currentTime);

      set({
        isProcessing: false,
        lastProcessTime: currentTime,
        documentCount: result.success
      });

      // 重新初始化 BM25 索引
      await initBM25Search();

      // 显示处理结果
      let description = `成功处理 ${result.success} 个文档`;
      if (result.failed > 0) {
        description += `，失败 ${result.failed} 个文档`;
        // 如果有失败文件，显示前几个
        if (result.failedFiles && result.failedFiles.length > 0) {
          const failedSample = result.failedFiles.slice(0, 3).map(f => f.fileName).join('、');
          description += `\n失败文件: ${failedSample}${result.failedFiles.length > 3 ? ' 等' : ''}`;
        }
      }

      processingToast.update({
        title: result.failed > 0 ? '向量处理完成（部分失败）' : '向量处理完成',
        description,
        variant: result.failed > 0 ? 'destructive' : 'default',
        duration: 5000,
      });
    } catch (error) {
      console.error('处理文档向量失败:', error);
      set({ isProcessing: false });

      const errorToast = {
        title: '向量处理失败',
        description: '处理文档向量时发生错误，请查看控制台日志',
        variant: 'destructive',
        duration: 5000,
      } as const;

      if (processingToast) {
        processingToast.update(errorToast);
      } else {
        toast(errorToast);
      }
    }
  },

  // 处理单个文档向量
  processDocument: async (filePath: string, content: string) => {
    try {
      await processMarkdownFile(filePath, content);
    } catch (error) {
      console.error(`处理文档 ${filePath} 向量失败:`, error);
    }
  },

  // 检查嵌入模型可用性
  checkEmbeddingModel: async () => {
    try {
      const modelAvailable = await checkEmbeddingModelAvailable();
      return modelAvailable;
    } catch (error) {
      console.error('检查嵌入模型失败:', error);
      return false;
    }
  },

  // 检查重排序模型可用性
  checkRerankModel: async () => {
    try {
      const modelAvailable = await checkRerankModelAvailable();
      set({ hasRerankModel: modelAvailable });
      return modelAvailable;
    } catch (error) {
      console.error('检查重排序模型失败:', error);
      set({ hasRerankModel: false });
      return false;
    }
  }
}));

export default useVectorStore;
