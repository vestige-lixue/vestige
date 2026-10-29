[English](README.md) | 中文

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="resources/logos/logo-white.svg" />
        <img src="resources/logos/logo-black.svg" alt="Vestige Logo" width="360" />
    </picture>
</p>

一个用于录音转写与校对的本地工作空间。

## 初衷

记忆会随时间淡去，语言也只能表达思想的一部分。

录音留住了某一刻的痕迹，转写则将其中的一部分化为文字。

这些片段正是 *Vestige* 名字的由来：那一刻虽已远去，我们仍能像考古工作者一样，从只言片语中回顾它留下的痕迹。

自动转写能为我们提供一份初稿。要把它变成可信的记录，仍需仔细聆听：修正识别错误的词语、补全遗漏的内容、核对陌生的名字。在播放器和文本编辑器之间来回切换，让这项工作变得繁琐，也容易忘记校对到了哪里。

Vestige 将聆听、转写与校对放在同一个工作空间中。目的是让细致的校对更轻松，让文字与录音保持关联，方便我们保存和回顾过去的痕迹。

## 功能

1. **完全本地转写**：使用兼容 whisper.cpp 或 sherpa-onnx 的模型，在自己的电脑上转写音频和视频。
2. **多份转写结果**：为同一段录音保留不同模型的转写结果，并选择其中一份作为校对的基础。
3. **自定义词库**：保存可复用的词语和短语修正，并在校对时提供匹配建议。
4. **播放与校对**：聆听原始录音，同时审阅转写文本、修正错误并补全遗漏内容。
5. **保存项目**：使用 JSON 格式的 `.vestige` 项目文件组织录音与转写文本，支持自动保存，并引用原始媒体文件。
6. **导出转写文本**：将原始转写文本或校对后的版本导出为纯文本或 SRT 字幕。

## 开发

### 环境要求

- Node.js 22.12+（22.x）或 24+
- pnpm 12.5.1
- Git

### 启动开发服务器

```shell
pnpm install
pnpm dev
```

### 打包应用

运行适用于当前平台的命令：

```shell
pnpm build:win   # Windows
pnpm build:mac   # macOS
pnpm build:linux # Linux
```

生成的应用包位于 `dist/release/`。Windows 打包需要 Inno Setup 6.3 或更新版本，安装在默认位置或将 `ISCC.exe` 加入 PATH 即可。

### 通过 GitHub Actions 构建发行版

[Build release 工作流](.github/workflows/release.yml) 使用对应架构的原生运行器，为 x64 和 arm64 分别构建 Windows Inno Setup 安装程序、macOS DMG 和 Linux AppImage。每个任务都会按 `package.json` 安装 pnpm，使用冻结的锁文件安装依赖，下载目标平台的原生程序，再执行现有类型检查、构建和打包命令。

转写后端与语音识别模型均在应用内下载。打包时准备 FFmpeg / ffprobe、aria2 和用于音频预处理的 Silero VAD 模型，支持的平台见[内置资源准备说明](resources/bin/README.md)。独立仓库 [macos-whisper-cli](https://github.com/vestige-lixue/macos-whisper-cli) 提供的 macOS Whisper 后端通过应用内的预置后端列表下载。

- **手动构建**：将工作流提交到默认分支后，打开 **Actions → Build release → Run workflow**，选择分支以及 `all` 或单个平台与架构。构建产物可在该次运行的 **Artifacts** 中下载，保留 14 天。手动运行只上传构建产物。
- **创建发行草稿**：将 `package.json` 设为目标版本并提交，然后推送对应标签，例如 `v0.1.0`。六个构建任务全部成功后，工作流会创建包含安装包和 `SHA256SUMS` 的 GitHub Release 草稿。标签必须严格等于 `v` 加包版本号；带预发布后缀的版本会创建预发布草稿。在 **Releases** 中检查文件和说明后即可发布。

重新运行标签构建会更新已有草稿，不会覆盖已发布的发行版附件。仅创建发行草稿的任务通过 GitHub 内置令牌获得 `contents: write` 权限，无需额外配置 Secret。Windows 安装程序未签名；macOS 应用采用临时签名（ad-hoc），未进行 Developer ID 签名或公证，因此仍可能出现操作系统的信任提示。

## 作者

[@ljm12914](https://github.com/ljm12914)

## 许可证

AGPL-3.0-or-later