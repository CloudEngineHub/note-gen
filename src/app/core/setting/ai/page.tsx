'use client'
import { Input } from "@/components/ui/input";
import { FormItem, SettingRow, SettingType } from "../components/setting-base";
import { useTranslations } from 'next-intl';
import { useEffect, useState } from "react";
import useSettingStore from "@/stores/setting";
import { Store } from "@tauri-apps/plugin-store";
import { BotMessageSquare, Copy, InfoIcon, X } from "lucide-react";
import ModelSelect from "./model-select";
import { AiConfig, ModelType } from "../config";
import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider"
import { v4 } from 'uuid';
import { confirm } from '@tauri-apps/plugin-dialog';
import { AiCheck } from "./ai-check";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import CreateConfig from "./create";

export default function AiPage() {
  const t = useTranslations('settings.ai');
  const {
    currentAi,
    setCurrentAi,
    aiType,
    setAiType,
    apiKey,
    setApiKey,
    baseURL,
    setBaseURL,
    setModel,
    setAiTitle,
    aiConfig,
    setAiConfig
  } = useSettingStore()
  const [title, setTitle] = useState<string>('')
  const [temperature, setTemperature] = useState<number>(0.7)
  const [topP, setTopP] = useState<number>(1.0)
  const [modelType, setModelType] = useState<ModelType>('chat')

  // 通过本地存储查询当前的模型配置
  async function getModelByStore(key: string) {
    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    setAiType(key)
    const model = aiModelList.find(item => item.key === key)
    if (model?.modelType) {
      setModelType(model.modelType)
    } else {
      setModelType('chat')
    }
    return model
  }

  // 模型选择变更
  async function selectChangeHandler(key: string) {
    const store = await Store.load('store.json');
    const model = await getModelByStore(key)
    if (!model) return
    switch (model.modelType) {
      case 'embedding':
        await store.set('embeddingModel', key)
        break;
      case 'rerank':
        await store.set('rerankingModel', key)
        break;
      default:
        break;
    }
    await store.set('aiType', key)
    setCurrentAi(aiConfig.find(item => item.key === key)?.key || '')
    setAiType(key)
    if (!model) return
    setBaseURL(model.baseURL || '')
    store.set('baseURL', model.baseURL || '')
    setApiKey(model.apiKey || '')
    store.set('apiKey', model.apiKey || '')
    setModel(model.model || '')
    store.set('model', model.model || '')
    setTemperature(model.temperature || 0.7)
    store.set('temperature', model.temperature || 0.7)
    setTopP(model.topP || 0.1)
    store.set('topP', model.topP || 0.1)
  }

  // 自定义名称
  async function titleChangeHandler(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    const model = await getModelByStore(aiType)
    if (!model) return
    model.title = e.target.value
    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList[aiModelList.findIndex(item => item.key === aiType)] = model
    setAiConfig(aiModelList)
    await store.set('aiModelList', aiModelList)
    await store.set('aiTitle', model.title || '')
    setAiTitle(model.title || '')
  }

  // 基础 URL 变更
  async function baseURLChangeHandler(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setBaseURL(value)
    const model = await getModelByStore(aiType)
    if (!model) return
    model.baseURL = value
    const store = await Store.load('store.json');
    store.set('baseURL', value)
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList[aiModelList.findIndex(item => item.key === aiType)] = model
    await store.set('aiModelList', aiModelList)
  }

  // API Key 变更
  async function apiKeyChangeHandler(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setApiKey(value)
    const model = await getModelByStore(aiType)
    if (!model) return
    model.apiKey = value
    const store = await Store.load('store.json');
    store.set('apiKey', value)
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList[aiModelList.findIndex(item => item.key === aiType)] = model
    await store.set('aiModelList', aiModelList)
  }

  // 删除自定义模型
  async function deleteCustomModelHandler() {
    const res = await confirm(t('deleteCustomModelConfirm'))
    if (!res) return
    const model = await getModelByStore(aiType)
    if (!model) return
    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList.splice(aiModelList.findIndex(item => item.key === aiType), 1)
    await store.set('aiModelList', aiModelList)
    setAiConfig(aiModelList)
    const first = aiModelList[0]
    if (!first) return
    selectChangeHandler(first.key)
    setCurrentAi(first.key)
    setAiType(first.key)
  }

  // temperature 变更处理
  async function temperatureChangeHandler(value: number[]) {
    setTemperature(value[0])
    const model = await getModelByStore(aiType)
    if (!model) return
    model.temperature = value[0]
    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList[aiModelList.findIndex(item => item.key === aiType)] = model
    await store.set('aiModelList', aiModelList)
    await store.set('temperature', value[0])
  }

  // topP 变更处理
  async function topPChangeHandler(value: number[]) {
    setTopP(value[0])
    const model = await getModelByStore(aiType)
    if (!model) return
    model.topP = value[0]
    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return
    aiModelList[aiModelList.findIndex(item => item.key === aiType)] = model
    await store.set('aiModelList', aiModelList)
    await store.set('topP', value[0] || 0.1)
  }

  // 模型类型变更处理
  async function modelTypeChangeHandler(value: ModelType) {
    setModelType(value)
    const store = await Store.load('store.json');
    switch (value) {
      case 'embedding':
        store.set('embeddingModel', aiType)
        break;
      case 'rerank':
        store.set('rerankingModel', aiType)
        break;
      default:
        break;
    }
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return

    const modelIndex = aiModelList.findIndex(item => item.key === aiType);
    if (modelIndex === -1) return;

    const model = aiModelList[modelIndex];
    model.modelType = value;

    aiModelList[modelIndex] = model;
    await store.set('aiModelList', aiModelList);

    // 重新测试 AI 状态
    // 通过触发 baseURL 的改变，间接让 AiCheck 组件重新检测
    // 先保存当前值，然后再恢复以触发检测
    const currentBaseURL = model.baseURL || '';
    setBaseURL('');
    setTimeout(() => {
      setBaseURL(currentBaseURL);
    }, 50);
  }

  // 复制当前配置
  async function copyConfig() {
    const model = await getModelByStore(aiType)
    if (!model) return

    const id = v4()
    const newModel: AiConfig = {
      ...model,
      key: id,
      title: `${model.title || 'Copy'} (Copy)`,
      modelType: model.modelType || 'chat', // Preserve the model type or default to chat
    }

    const store = await Store.load('store.json');
    const aiModelList = await store.get<AiConfig[]>('aiModelList')
    if (!aiModelList) return

    const updatedList = [...aiModelList, newModel]
    await store.set('aiModelList', updatedList)
    setAiConfig(updatedList)

    selectChangeHandler(id)
    setCurrentAi(newModel.key)
  }

  useEffect(() => {
    async function init() {
      const store = await Store.load('store.json');
      const aiType = await store.get<string>('aiType')
      if (!aiType) return
      setAiType(aiType)
      const aiModelList = await store.get<AiConfig[]>('aiModelList') || []
      setAiConfig(aiModelList)
      const model = await getModelByStore(aiType)
      if (!model) return
      switch (model.modelType) {
        case 'embedding':
          await store.set('embeddingModel', model.key)
          break;
        case 'rerank':
          await store.set('rerankingModel', model.key)
          break;
        default:
          break;
      }
      await store.set('aiType', aiType)
      setCurrentAi(model.key)
      setBaseURL(model.baseURL || '')
      setApiKey(model.apiKey || '')
      setModel(model.model || '')
      setTemperature(model.temperature || 0.7)
      setTopP(model.topP || 0.1)
      setModelType(model.modelType || 'chat')
    }
    init()
  }, [])

  return (
    <SettingType id="ai" icon={<BotMessageSquare />} title={t('title')} desc={t('desc')}>
      <SettingRow>
        <FormItem title="Model Provider" desc={t('modelProviderDesc')}>
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <Select value={currentAi} onValueChange={selectChangeHandler}>
              <SelectTrigger className="w-full lg:w-[240px] flex">
                <div className="flex items-center gap-2">
                  <AiCheck />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {
                  aiConfig.map((item) => (
                    <SelectItem value={item.key} key={item.key}>{item.title}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
            <CreateConfig />
            {
              aiConfig.length > 0 && (
                <div className="flex gap-2">
                  <Button onClick={copyConfig}><Copy />{t('copyConfig')}</Button>
                  <Button variant={'destructive'} onClick={deleteCustomModelHandler}><X />{t('deleteCustomModel')}</Button>
                </div>
              )
            }
          </div>
        </FormItem>
      </SettingRow>
      {
        aiType === 'custom' && (
          <SettingRow>
            <span className="my-2 flex items-center gap-2"><InfoIcon className="size-4" />{t('modelSupport')}</span>
          </SettingRow>
        )
      }
      {
        currentAi && (
          <SettingRow>
            <FormItem title={t('modelTitle')} desc={t('modelTitleDesc')}>
              <Input value={title} onChange={titleChangeHandler} />
            </FormItem>
          </SettingRow>
        )
      }
      <SettingRow>
        <FormItem title="BaseURL" desc={t('modelBaseUrlDesc')}>
          <Input value={baseURL} onChange={baseURLChangeHandler} />
        </FormItem>
      </SettingRow>
      <SettingRow>
        <FormItem title="API Key">
          <Input value={apiKey} onChange={apiKeyChangeHandler} />
        </FormItem>
      </SettingRow>
      <SettingRow>
        <FormItem title="Model" desc={t('modelDesc')}>
          <ModelSelect />
        </FormItem>
      </SettingRow>
      <SettingRow>
        <FormItem title={t('modelType.title')} desc={t('modelType.desc')}>
          <RadioGroup
            value={modelType}
            onValueChange={(value) => modelTypeChangeHandler(value as ModelType)}
            className="flex flex-wrap gap-6 m-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="chat" id="chat" />
              <Label htmlFor="chat">{t('modelType.chat')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="image" id="image" disabled />
              <Label htmlFor="image" className="text-muted-foreground">{t('modelType.image')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="video" id="video" disabled />
              <Label htmlFor="video" className="text-muted-foreground">{t('modelType.video')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="audio" id="audio" disabled />
              <Label htmlFor="audio" className="text-muted-foreground">{t('modelType.audio')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="embedding" id="embedding" />
              <Label htmlFor="embedding">{t('modelType.embedding')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="rerank" id="rerank" />
              <Label htmlFor="rerank">{t('modelType.rerank')}</Label>
            </div>
          </RadioGroup>
        </FormItem>
      </SettingRow>
      {
        modelType === 'chat' && (
          <>
            <SettingRow>
              <FormItem title="Temperature" desc={t('temperatureDesc')}>
                <div className="flex gap-2 py-2">
                  <Slider
                    className="w-64"
                    value={[temperature]}
                  max={2}
                  step={0.01}
                  onValueChange={temperatureChangeHandler}
                  />
                  <span className="text-zinc-500">{temperature}</span>
                </div>
              </FormItem>
          </SettingRow>
          <SettingRow>
            <FormItem title="Top P" desc={t('topPDesc')}>
              <div className="flex gap-2 py-2">
                <Slider
                  className="w-64"
                  value={[topP]}
                  max={1}
                  min={0}
                  step={0.01}
                  onValueChange={topPChangeHandler}
                />
                <span className="text-zinc-500">{topP}</span>
              </div>
            </FormItem>
          </SettingRow>
        </>)
      }
    </SettingType>
  )
}