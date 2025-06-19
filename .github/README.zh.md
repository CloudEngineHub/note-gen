# NoteGen

![](https://img.shields.io/badge/free-pricing?logo=free&color=%20%23155EEF&label=pricing&labelColor=%20%23528bff)
![](https://github.com/codexu/note-gen/actions/workflows/release.yml/badge.svg?branch=release)
![](https://img.shields.io/github/v/release/codexu/note-gen)
![](https://img.shields.io/github/downloads/codexu/note-gen/total)
![](https://img.shields.io/github/commit-activity/m/codexu/note-gen)
![](https://img.shields.io/github/issues-closed/codexu/note-gen)

<div>
  <a href="https://trendshift.io/repositories/12784" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12784" alt="codexu%2Fnote-gen | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
  <a href="https://www.producthunt.com/products/notegen-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-notegen&#0045;2" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=956348&theme=light&t=1749194675492" alt="NoteGen - A&#0032;cross&#0045;platform&#0032;Markdown&#0032;note&#0045;taking&#0032;application | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</div>

## 指南

[English](../README.md) | 简体中文 | [日本語](README.ja.md)

🖥️ 官方文档：[https://notegen.top](https://notegen.top)

💬 加入群聊：[微信/QQ群](https://github.com/codexu/note-gen/discussions/110)、[Discord](https://discord.gg/SXyVZGpbpk)、[Telegram](https://t.me/notegen)

NoteGen 是一款跨平台的 `Markdown` 笔记应用，致力于使用 AI 建立记录和写作的桥梁，将碎片化知识整理成一篇可读的笔记。

![](https://s2.loli.net/2025/06/13/UbVGPrhFl3etnQz.png)

## 为什么选择 NoteGen？

- **轻量**：[安装包](https://github.com/codexu/note-gen/releases)**仅20MB**，免费且无任何广告或捆绑软件。
- **跨平台**：得益于 `Tauri2` 的跨平台能力，支持 Windows、MacOS、Linux、iOS 和 Android，支持免费多设备数据同步。
- 支持`截图`、`文本`、`插图`、`文件`、`链接`等多种记录方式，满足各类场景的碎片化记录需求。
- **原生 `Markdown(.md)` 作为存储格式**，拒绝魔改，方便迁移。
- **原生离线使用**，支持实时同步到 `GitHub、Gitee 私有仓库`，支持历史回滚和 WebDAV 同步。
- **AI 加持**：可配置 ChatGPT、Gemini、Ollama、LM Studio、Grok 等多种模型，支持自定义第三方模型配置。
- **RAG 支持**：你的笔记就是你的知识库，支持嵌入模型和重排序模型。

## 截图

记录：

![1.png](https://s2.loli.net/2025/05/19/Cs5viKfkqb2HJmd.png)

写作：

![2.png](https://s2.loli.net/2025/05/19/5vwQBPoLr6jzgUA.png)

主题：

![3.png](https://s2.loli.net/2025/05/19/8yU72prmWdsCHeu.png)

## 从记录到写作

常规的笔记应用通常不会提供记录功能。用户需要手动复制粘贴内容进行记录，大大降低了效率。面对零散的记录内容时，更是需要花费大量精力进行整理。

NoteGen 分为`记录`和`写作`两个页面，关系如下：

- 记录可以整理为笔记，转移至写作页面进行深度编写。
- 写作时可以随时插入记录。

### 记录

记录功能类似于 **AI 聊天机器人**，但在与其对话时，你可以关联以前记录的内容，从对话模式切换到整理模式，将记录整理成一篇可读的笔记。

以下辅助功能可以帮助你更有效地进行记录：

- **标签**：用于区分不同的记录场景。
- **人设**：支持自定义提示词，精准控制你的 AI 助手。
- **剪贴板助手**：自动识别剪贴板中的文本或图片，并将其记录到列表中。

### 写作

写作部分分为**文件管理器**和**Markdown 编辑器**两个部分。

**文件管理器**

- 支持管理本地 Markdown 文件和 GitHub 同步文件。
- 支持无限层级目录。
- 支持多种排序方式。

**Markdown 编辑器**

- 支持所见即所得、即时渲染和分屏预览模式。
- 支持版本控制，可以回滚历史记录。
- 支持 AI 辅助，提供对话、续写、润色和翻译功能。
- 支持图床，可以上传图片并转换为 Markdown 图片链接。
- 支持 HTML 到 Markdown 转换，自动将复制的浏览器内容转换为 Markdown 格式。
- 支持大纲、数学公式、思维导图、图表、流程图、甘特图、时序图、五线谱、多媒体、语音阅读、标题锚点、代码高亮和复制、graphviz 渲染、plantuml UML 图。
- 支持实时本地内容保存、延时（10秒未编辑）自动同步和历史回滚。

## 如何使用？

### 下载

目前支持 Mac、Windows、Linux。得益于 Tauri2 的跨平台能力，未来将支持 iOS 和 Android。

| Windows | MacOS | Linux | Android | iOS |
| --- | --- | --- | --- | --- |
| ✅ beta | ✅ beta | ✅ beta | 🛠️ alpha | 🛠️ alpha |
| [下载 17 MB](https://notegen.top/en/download.html) | [下载 20.7 MB](https://notegen.top/en/download.html) | [下载 21.7 MB](https://notegen.top/en/download.html) | [下载](https://notegen.top/en/download.html) | [下载](https://notegen.top/en/download.html) |

> 由 [UpgradeLink](http://upgrade.toolsetlink.com/upgrade/example/tauri-example.html) 提供

### 增强

笔记应用可以无需配置直接使用。如果你想获得更好的体验，请打开设置页面配置 AI 和同步功能。

## 其他功能

- 全局搜索，快速查找并跳转到特定内容。
- 图床管理，方便管理图片仓库内容。
- 主题和外观，支持深色主题和 Markdown、代码等外观设置。
- 国际化支持，目前支持中文和英文。

## 贡献

- [阅读贡献指南](CONTRIBUTING.md)
- [更新计划](https://github.com/codexu/note-gen/issues/46)
- [提交 Bug 或改进建议](https://github.com/codexu/note-gen/issues)
- [讨论](https://github.com/codexu/note-gen/discussions)

## 贡献者

<a href="https://github.com/codexu/note-gen/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=codexu/note-gen" />
</a>

## 赞助商

<div>
  <a href="https://docs.siliconflow.cn/cn/usercases/use-siliconcloud-in-NoteGen?utm_source=NoteGen" target="_blank">
    <img src="https://s2.loli.net/2025/06/11/65TLRh813e2YFzr.png" />
  </a>
  <a href="https://www.qiniu.com/products/ai-token-api?utm_source=NoteGen" target="_blank">
    <img src="https://s2.loli.net/2025/06/11/OKJq542lTs7U9xg.png" />
  </a>
  <a href="http://upgrade.toolsetlink.com/upgrade/example/tauri-example.html" target="_blank">
    <img src="https://s2.loli.net/2025/06/11/r2dqNIWVXp4RaFe.png" />
  </a>
</div>

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=codexu/note-gen&type=Date)](https://www.star-history.com/#codexu/note-gen&Date)
