# 国产模型平台真实连接测试

- 测试日期：2026-08-16
- 测试环境：NoteGen 0.34.1（macOS 正式应用）及当前源码调试构建
- 测试方式：在 NoteGen 模型服务中配置独立 API Key，通过对话界面发起真实流式请求
- 安全约束：报告不记录 API Key、账户信息或完整响应内容

## 测试结果

| 平台 | API 地址 | 模型 | 结果 | 完成耗时 | 备注 |
| --- | --- | --- | --- | ---: | --- |
| MiniMax | `https://api.minimaxi.com/v1` | `MiniMax-M2.7` | 通过 | 约 13.1 秒 | NoteGen 对话收到并完成流式输出 |
| Kimi | `https://api.moonshot.cn/v1` | `kimi-k2.6` | 通过 | 约 8.6 秒 | 当前源码调试构建的 NoteGen 对话收到 `OK` 并完成流式输出 |
| 阿里云百炼 | 专属 OpenAI 兼容地址 | `qwen3.7-flash` | 通过 | 约 3.6 秒 | NoteGen“检测连接”提示通过；同一 Token 的直接请求约 1.4 秒 |
| 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-2-0-lite-260428` | 未通过（账号未开通模型） | 约 2.2 秒 | Token 和模型列表鉴权通过；NoteGen 返回 `ModelNotOpen`，未擅自开通可能计费的模型服务 |
| 百度千帆 | `https://qianfan.baidubce.com/v2` | `ernie-4.5-turbo-20260402` | 通过 | 约 1.7 秒 | NoteGen“检测连接”提示通过；同一 Token 的直接请求约 0.36 秒 |
| 腾讯云 TokenHub | `https://tokenhub.tencentmaas.com/v1` | - | 未测试（需开通付费服务） | - | 旧混元平台已停止创建 Key；新平台要求同意服务条款并开通按量计费 |

## 待测试平台

- 智谱 GLM
- 腾讯云 TokenHub（需用户确认开通付费服务）
- 阶跃星辰
- 零一万物
- 华为云 MaaS
- 百川智能

## 测试记录

### MiniMax

1. 在 MiniMax 控制台创建独立测试 API Key。
2. 在 NoteGen 中配置 `https://api.minimaxi.com/v1` 和 `MiniMax-M2.7`。
3. 首次自动输入丢失了 API Key 前缀，NoteGen 返回 401；重新完整写入凭据后恢复正常。
4. 使用 NoteGen 对话界面发起真实请求，模型成功返回并完成流式输出。

> 401 属于自动化输入完整性问题，不是 MiniMax 接口或 NoteGen 兼容性问题。

### Kimi

1. 在 Kimi 控制台创建独立测试 API Key，并写入 NoteGen 的安全配置。
2. NoteGen 使用该凭据成功拉取模型列表，确认 API 地址、Token 保存和鉴权有效。
3. 使用相同凭据直接请求 `kimi-k2.6`，接口返回 HTTP 200，耗时约 652 毫秒。
4. NoteGen 0.34.1 的“检测连接”在 28 秒观察窗口内未显示成功或错误；使用对话界面时，真实返回 400，提示该模型只允许固定 temperature。
5. 定位到无工具的普通对话没有应用模型采样参数兼容处理；修复后使用当前源码调试构建重新发送“只回复 OK”。
6. NoteGen 成功收到 `OK` 并完成流式输出，耗时约 8.6 秒。

### 阿里云百炼

1. 在百炼控制台创建独立测试 API Key，并使用控制台提供的业务空间专属 OpenAI 兼容地址。
2. 使用该凭据成功拉取模型列表；直接请求 `qwen3.7-flash` 返回 HTTP 200，耗时约 1.4 秒。
3. 将同一凭据保存到当前源码调试构建的 NoteGen，模型“检测连接”提示通过，耗时约 3.6 秒。

### 火山方舟

1. 创建独立 API Key，并成功通过 `/models` 拉取模型列表。
2. 将凭据和 `doubao-seed-2-0-lite-260428` 保存到 NoteGen 后运行连接检测。
3. NoteGen 返回 `ModelNotOpen`，说明账号尚未开通该模型；未执行可能产生费用的开通操作。

### 百度千帆

1. 创建独立 API Key，并成功通过 `/models` 拉取模型列表。
2. 直接请求 `ernie-4.5-turbo-20260402` 返回 HTTP 200，耗时约 364 毫秒。
3. 将同一凭据保存到 NoteGen 后运行连接检测，提示通过，耗时约 1.7 秒。

### 腾讯云 TokenHub

1. 旧“腾讯混元”控制台已于 2026-06-30 停止新增订购和创建 API Key，并计划于 2026-09-30 下线。
2. 模板已迁移到 TokenHub 的 OpenAI 兼容地址和新 API Key 管理页。
3. 当前账号尚未开通 TokenHub；开通页面要求接受服务条款并按实际调用量计费，因此未代为开通。
