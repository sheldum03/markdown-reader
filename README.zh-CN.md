# Markdown Reader

[English](README.md) | 中文

> 一个本地优先的 Markdown 工作区，用于编辑、审阅并导出可分享的 HTML。

Markdown Reader 是一款面向 macOS 和 Windows 的桌面应用，适合撰写和审阅 Markdown 文件。打开你拥有控制权的文件夹，直接编辑文档、留下锚定评论，再导出独立的 HTML 阅读版。核心编辑、评论、搜索和导出均无需账号或 API 密钥。

## 可以做什么

- 使用所见即所得编辑器编辑 Markdown，文件仍保留在原文件夹中。
- 以原始文本方式查看和编辑 YAML，并保留其语法。
- 添加与源文档分开存储的锚定审阅评论。
- 搜索文件名和工作区内容。
- 将 Markdown 导出为独立 HTML，并可选择嵌入源文件视图。
- 在 Markdown 文档工具栏的“富文本编辑”按钮旁生成中文翻译副本；在你明确配置并同意使用 AI 服务商后，生成 AI 阅读版。

## 30 秒上手

1. 打开一个包含 Markdown 或 YAML 文件的文件夹。
2. 选择一段文本并添加评论。
3. 打开 **文档工具**，导出 HTML 阅读版。

以上流程无需配置 AI。

## 创建中文翻译副本

打开 Markdown 文档后，先在“文档工具”中选择翻译服务，再点击“富文本编辑”旁的翻译按钮。应用会先保存待写入的修改，再创建单独的中文副本，不会覆盖源文档。

## 本地运行

要求：macOS，或 Windows 10 22H2 / Windows 11 x64；Node.js 24+、pnpm 11.7.0 和 Rust 1.96+。Windows 开发使用 `x86_64-pc-windows-msvc` Rust target，并需安装 Tauri 所需的 Microsoft C++ 构建工具。

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

## Windows 安装器

第一阶段仅支持 Windows 10 22H2 和 Windows 11 x64。在 Windows 上构建按当前用户安装的 NSIS `setup.exe`：

```powershell
pnpm install --frozen-lockfile
pnpm run tauri:build:windows
```

安装器默认不要求管理员权限，并使用 Tauri 的 WebView2 `downloadBootstrapper` 模式；系统缺少 WebView2 时，安装过程需要联网。单个安装器包含英文和简体中文。ARM64、32 位 Windows、MSI、Microsoft Store、Windows 7/8、离线安装器和 UNC 网络工作区不在本阶段范围内。

## 隐私与 AI

应用默认在本地运行。打开、编辑、评论、搜索和 HTML 导出均在你选择的文件夹中执行。

AI 工具完全可选。在创建 AI 阅读版或发起文档助手请求前，应用会征求确认，并只向你选择的服务商发送当前 Markdown 以及必要的未解决评论。保存兼容 OpenAI 的设置时，API 密钥会写入当前用户的应用配置目录，供后续使用。存储与安全细节详见[隐私声明](PRIVACY.zh-CN.md)。

## Beta 限制

大幅编辑文档后，评论高亮的位置可能不够准确；超大 Markdown 文档尚未完成性能测试。重要工作请保留副本，并在关键工作流中使用前查看 [Beta 限制](BETA_LIMITATIONS.zh-CN.md)。

## 代码签名政策（Code signing policy）

项目目前没有 Authenticode 证书，因此 Windows Preview 明确以未签名形式发布。
Windows 可能显示“未知发布者”或 SmartScreen 提示；Preview 不能宣传为已签名版本。
运行前应使用 Release 同时提供的 `SHA256SUMS.txt` 核对安装包 SHA-256。

在完成 Authenticode 配置前，不发布 Windows 正式版。所有官方 Windows 发布产物
只能由受保护的 `v*` tag 触发 GitHub Actions 构建，并由同一工作流上传到对应的
GitHub Release；本地构建或人工上传的可执行文件不属于官方发布。签名私钥必须保存
在仓库之外的硬件或托管签名服务中，只能向受保护的发布环境开放，维护者不得把私钥
提交到仓库或导出分发。

当前单维护者项目的发布角色如下：

- Maintainer（维护者）：[@sheldum03](https://github.com/sheldum03)，负责仓库与 CI。
- Reviewer（审核者）：[@sheldum03](https://github.com/sheldum03)，负责代码与依赖审核。
- Approver（批准者）：[@sheldum03](https://github.com/sheldum03)，负责批准发布 tag。

目前三项角色透明但不独立；在发布已签名正式版前，建议增加一位独立 Reviewer。
所有具有写入、审核或发布权限的账号都必须启用 MFA。依赖再分发审核见
[DEPENDENCY_LICENSE_REVIEW.md](DEPENDENCY_LICENSE_REVIEW.md)。

## 发布状态

这是桌面 Beta 版本。macOS 应用、DMG smoke 和真实 Tauri E2E 已在本机 macOS 验证。Windows x64 GitHub Actions 门禁已完整通过，覆盖类型检查、前端与 Rust 测试、Vite 构建、真实 Tauri E2E、NSIS 构建和产物上传；当前运行记录见 [GitHub Actions](https://github.com/sheldum03/md-html-reader/actions/workflows/ci.yml)。Windows 10/11 实机清单仍是发布门禁。macOS Developer ID/公证和 Windows 正式版 Authenticode 签名也仍依赖外部凭据。详见 [发布检查清单](RELEASE_CHECKLIST.md)。

## 开发检查

```bash
pnpm exec vue-tsc --noEmit
pnpm test -- --run
pnpm build
(cd src-tauri && cargo test)
pnpm run tauri:build:windows # 仅 Windows x64
```

## 产品文档

- [隐私声明](PRIVACY.zh-CN.md)
- [Beta 限制](BETA_LIMITATIONS.zh-CN.md)
- [发布检查清单](RELEASE_CHECKLIST.md)
- [人工验收指南](MANUAL_ACCEPTANCE.md)
- [Windows 10/11 人工验收指南](WINDOWS_ACCEPTANCE.md)
- [依赖再分发审核](DEPENDENCY_LICENSE_REVIEW.md)

## 许可证

本项目采用 [MIT 许可证](LICENSE)开源。
