'use client'
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartScatter,
  ChevronDown,
  CircleCheck,
  CircleX,
  ListOrdered,
  LoaderCircle,
  MessageSquare,
  Mic,
  Trash2,
  Volume2,
  type LucideIcon,
} from "lucide-react"
import { ModelConfig, ModelType, AiConfig } from "../config"
import { useTranslations } from 'next-intl'
import ModelSelect from "./modelSelect"
import { useState, useRef } from "react"
import { createOpenAIClient } from "@/lib/ai/utils"
import { toast } from "@/hooks/use-toast"
import { blobToBytes, invokeAiBinary, invokeAiJson, invokeAiMultipart, resolveAiRequestConfig } from "@/lib/ai/tauri-client"

interface ModelCardProps {
  modelConfig: ModelConfig
  aiConfig: AiConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (modelId: string, field: keyof ModelConfig, value: any) => void
  onDelete: (modelId: string) => void
}

const modelTypeOptions: Array<{
  value: ModelType
  icon: LucideIcon
}> = [
  { value: 'chat', icon: MessageSquare },
  { value: 'tts', icon: Volume2 },
  { value: 'stt', icon: Mic },
  { value: 'embedding', icon: ChartScatter },
  { value: 'rerank', icon: ListOrdered },
]

export default function ModelCard({
  modelConfig,
  aiConfig,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: ModelCardProps) {
  const t = useTranslations('settings.ai')
  const tc = useTranslations('common')
  const [checkState, setCheckState] = useState<'ok' | 'error' | 'checking' | 'init'>('init')
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleCheck = async () => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setCheckState('checking')
    abortControllerRef.current = new AbortController()
    
    try {
      const aiStatus = await checkModelStatus(modelConfig, aiConfig, abortControllerRef.current.signal)
      if (aiStatus) {
        setCheckState('ok')
        toast({
          description: t('connectionSuccess'),
          className: 'border-green-500 bg-green-50 text-green-800'
        })
      } else {
        setCheckState('error')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setCheckState('error')
    }
  }

  const checkModelStatus = async (model: ModelConfig, aiConfig: AiConfig, signal?: AbortSignal) => {
    try {
      if (!model.model || !aiConfig.baseURL) return false

      const fullAiConfig: AiConfig = {
        ...aiConfig,
        model: model.model,
        modelType: model.modelType,
        temperature: model.temperature,
        topP: model.topP,
        voice: model.voice,
        enableStream: model.enableStream
      }
      const requestConfig = await resolveAiRequestConfig(fullAiConfig)

      switch (model.modelType) {
        case 'rerank':
          const query = 'Apple'
          const documents = ["apple","banana","fruit","vegetable"]
          const rerankData = await invokeAiJson<any>({
            config: requestConfig,
            path: '/rerank',
            method: 'POST',
            body: {
              model: model.model,
              query,
              documents
            }
          }, signal)
          if (!rerankData || !rerankData.results) {
            throw new Error('重排序结果格式不正确')
          }
          return true

        case 'embedding':
          const testText = '测试文本'
          const embeddingDataJson = await invokeAiJson<any>({
            config: requestConfig,
            path: '/embeddings',
            method: 'POST',
            body: {
              model: model.model,
              input: testText,
              encoding_format: 'float'
            }
          }, signal)
          if (!embeddingDataJson || !embeddingDataJson.data || !embeddingDataJson.data[0] || !embeddingDataJson.data[0].embedding) {
            throw new Error('嵌入结果格式不正确')
          }
          return true

        case 'tts':
          const testAudioText = '测试音频生成'
          const ttsBuffer = await invokeAiBinary({
            config: requestConfig,
            path: '/audio/speech',
            method: 'POST',
            body: {
              model: model.model,
              input: testAudioText,
              voice: model.voice || 'alloy'
            }
          }, signal)
          if (!ttsBuffer.byteLength) {
            throw new Error('TTS模型返回格式不正确')
          }
          return true

        case 'stt':
          const testAudioBlob = new Blob([new Uint8Array(100)], { type: 'audio/webm' })
          try {
            await invokeAiMultipart({
              config: requestConfig,
              path: '/audio/transcriptions',
              fileFieldName: 'file',
              fields: {
                model: model.model
              },
              file: {
                bytes: await blobToBytes(testAudioBlob),
                fileName: 'test.webm',
                contentType: 'audio/webm',
              }
            }, signal)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('401') || message.includes('403')) {
              throw new Error(message)
            }
          }
          return true

        default:
          const openai = await createOpenAIClient(fullAiConfig)
          await openai.chat.completions.create({
            model: model.model,
            messages: [{
              role: 'user' as const,
              content: 'Hello'
            }],
          })
          return true
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Error',
        variant: 'destructive'
      })
      return false
    }
  }

  const renderCheckIcon = () => {
    switch (checkState) {
      case 'ok':
        return <CircleCheck data-icon="inline-start" className="text-green-500" />
      case 'error':
        return <CircleX data-icon="inline-start" className="text-red-500" />
      case 'checking':
        return <LoaderCircle data-icon="inline-start" className="animate-spin" />
      default:
        return null
    }
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card size="sm">
        <CardHeader
          className="cursor-pointer items-center"
          onClick={() => onOpenChange(!open)}
        >
          <CardTitle className="flex min-w-0 items-center gap-2">
            <span className="truncate">{modelConfig.model || t('newModel')}</span>
            <Badge variant="secondary">
              {t(`modelType.${modelConfig.modelType}`)}
            </Badge>
          </CardTitle>
          <CardAction
            className="row-span-1 flex items-center gap-2 self-center"
            onClick={(event) => event.stopPropagation()}
          >
            <ButtonGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheck}
                disabled={!modelConfig.model || checkState === 'checking'}
              >
                {renderCheckIcon()}
                {t('checkConnection')}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={tc('delete')}
                onClick={() => onDelete(modelConfig.id)}
              >
                <Trash2 />
              </Button>
            </ButtonGroup>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="group"
                aria-label={t('models')}
              >
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>{t('model')}</FieldLabel>
                <ModelSelect
                  model={modelConfig.model}
                  setModel={(model) => onUpdate(modelConfig.id, 'model', model)}
                  aiConfig={aiConfig}
                />
              </Field>

              <Field>
                <FieldLabel>{t('modelType.title')}</FieldLabel>
                <Tabs
                  orientation="horizontal"
                  value={modelConfig.modelType}
                  onValueChange={(value) => onUpdate(modelConfig.id, 'modelType', value as ModelType)}
                >
                  <TabsList className="group-data-vertical/tabs:h-8 group-data-vertical/tabs:flex-row">
                    {modelTypeOptions.map(({ value, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="group-data-vertical/tabs:w-auto group-data-vertical/tabs:justify-center"
                      >
                        <Icon data-icon="inline-start" />
                        {t(`modelType.${value}`)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Field>

              {modelConfig.modelType === 'chat' && (
                <Collapsible>
                  <Card size="sm">
                    <CardHeader className="items-center">
                      <CardTitle>{t('advancedParameters')}</CardTitle>
                      <CardAction className="row-span-1 self-center">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="group"
                            aria-label={t('advancedParameters')}
                          >
                            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      </CardAction>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <FieldGroup>
                          <Field>
                            <FieldLabel>{t('maxTokens')}</FieldLabel>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={modelConfig.maxTokens ?? ''}
                              placeholder={t('maxTokensPlaceholder')}
                              onChange={(event) => {
                                const value = event.target.value
                                onUpdate(modelConfig.id, 'maxTokens', value === '' ? undefined : Number(value))
                              }}
                            />
                            <FieldDescription>{t('maxTokensDesc')}</FieldDescription>
                          </Field>

                          <Field>
                            <FieldLabel>{t('tokenLimitParam')}</FieldLabel>
                            <RadioGroup
                              value={modelConfig.tokenLimitParam || 'max_completion_tokens'}
                              onValueChange={(value) => onUpdate(
                                modelConfig.id,
                                'tokenLimitParam',
                                value as ModelConfig['tokenLimitParam']
                              )}
                            >
                              <Field orientation="horizontal">
                                <RadioGroupItem
                                  value="max_completion_tokens"
                                  id={`max-completion-tokens-${modelConfig.id}`}
                                />
                                <FieldLabel htmlFor={`max-completion-tokens-${modelConfig.id}`}>
                                  max_completion_tokens
                                </FieldLabel>
                              </Field>
                              <Field orientation="horizontal">
                                <RadioGroupItem
                                  value="max_tokens"
                                  id={`max-tokens-${modelConfig.id}`}
                                />
                                <FieldLabel htmlFor={`max-tokens-${modelConfig.id}`}>
                                  max_tokens
                                </FieldLabel>
                              </Field>
                            </RadioGroup>
                            <FieldDescription>{t('tokenLimitParamDesc')}</FieldDescription>
                          </Field>

                          <Field>
                            <FieldLabel>Temperature</FieldLabel>
                            <div className="flex items-center gap-3">
                              <Slider
                                className="flex-1"
                                value={[modelConfig.temperature || 0.7]}
                                max={2}
                                step={0.01}
                                onValueChange={(value) => onUpdate(modelConfig.id, 'temperature', value[0])}
                              />
                              <Badge variant="outline">
                                {(modelConfig.temperature || 0.7).toFixed(2)}
                              </Badge>
                            </div>
                          </Field>

                          <Field>
                            <FieldLabel>Top P</FieldLabel>
                            <div className="flex items-center gap-3">
                              <Slider
                                className="flex-1"
                                value={[modelConfig.topP || 1.0]}
                                max={1}
                                min={0}
                                step={0.01}
                                onValueChange={(value) => onUpdate(modelConfig.id, 'topP', value[0])}
                              />
                              <Badge variant="outline">
                                {(modelConfig.topP || 1.0).toFixed(2)}
                              </Badge>
                            </div>
                          </Field>

                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldTitle>{t('enableStream')}</FieldTitle>
                              <FieldDescription>{t('enableStreamDesc')}</FieldDescription>
                            </FieldContent>
                            <Switch
                              checked={modelConfig.enableStream !== false}
                              onCheckedChange={(checked) => onUpdate(modelConfig.id, 'enableStream', checked)}
                            />
                          </Field>
                        </FieldGroup>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {modelConfig.modelType === 'tts' && (
                <Field>
                  <FieldLabel>{t('voice')}</FieldLabel>
                  <Input
                    value={modelConfig.voice || ''}
                    onChange={(event) => onUpdate(modelConfig.id, 'voice', event.target.value)}
                    placeholder={t('voicePlaceholder')}
                  />
                </Field>
              )}
            </FieldGroup>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
