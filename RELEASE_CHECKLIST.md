# 发布清单

本文是当前 Vue + Milkdown + Tauri 主线的唯一发布状态来源。README、路线图和人工验收文档只说明各自范围，不重复判定发布是否完成。

## 当前结论

- 内测构建：核心自动化与已记录的人工原生交互可作为依据。
- 正式 macOS 发布：**未完成**。Developer ID 签名、公证和 notarized DMG 安装验证尚未完成。
- Windows 未签名 Preview：自动化构建门禁已首次完整通过；仍需从受保护 tag 发布 GitHub prerelease，并完成 Windows 11 实机验收。
- Windows 10/11 x64 正式版：**未完成**。仍需 Windows 10 22H2 / Windows 11 实机验收和外部 Authenticode 证书。

## 发布门禁

| 门禁 | 当前状态 | 证据或执行方式 |
|------|----------|----------------|
| 前端类型检查、单元测试和生产构建 | 已在本地验证 | `pnpm exec vue-tsc --noEmit`、`pnpm test -- --run`、`pnpm build` |
| Rust 命令层测试 | 已在本地验证 | `(cd src-tauri && cargo test)` |
| 真实 Tauri 窗口 E2E | 已在本地验证 | `pnpm run test:e2e`，覆盖核心路径与跨进程评论持久化 |
| 原生人工交互 | 已通过 | [2026-07-11 记录](docs/manual-acceptance-2026-07-11.md) 与 [2026-07-12 补充](docs/manual-acceptance-2026-07-12.md) |
| GitHub Actions 复现上述自动化门禁 | 已通过 | [`macos` 与 `windows` 工作流](https://github.com/sheldum03/markdown-reader/actions/workflows/ci.yml) |
| Developer ID 签名、公证和 notarized DMG 安装验证 | 未完成 | 配置证书和 `NOTARY_KEYCHAIN_PROFILE` 后执行 `pnpm run release:notarize` |
| Windows x64 类型检查、前端测试、Vite build、Rust 测试 | 已通过 | [Windows GitHub Actions](https://github.com/sheldum03/markdown-reader/actions/workflows/ci.yml)，Rust target 为 `x86_64-pc-windows-msvc` |
| Windows 真实 Tauri E2E | 已通过 | 同一 Windows 作业；WebdriverIO embedded provider 覆盖 core、icons、sidebar、reopen，使用动态端口和 `.exe` 路径 |
| Windows NSIS 构建与 artifact | 已通过 | 同一 Windows 作业执行 `pnpm run tauri:build:windows`，上传 `windows-nsis-x64` artifact |
| Windows 10 22H2 / Windows 11 x64 实机验收 | 未完成 | 按 [WINDOWS_ACCEPTANCE.md](WINDOWS_ACCEPTANCE.md) 分别记录安装、核心功能、重装和卸载 |
| Windows Authenticode 签名与签名验证 | 未完成 | 需要外部代码签名证书；证书与私钥不得提交仓库 |

## 复核规则

1. 每次准备发布时，先确认 GitHub Actions 对该提交已通过。
2. 若原生目录选择、保存对话框、键盘编辑、鼠标选区或窗口关闭行为有改动，按 [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) 重新记录受影响路径。
3. 只有表中全部门禁完成，才可将构建标记为正式 macOS 发布；签名和公证未闭环前，只能称为内测或 ad-hoc 构建。
4. Windows 仅支持 Windows 10 22H2 / Windows 11 x64、NSIS 当前用户在线安装。ARM64、32 位、MSI、Microsoft Store、Windows 7/8、离线安装与 UNC 网络路径不能作为本阶段“已支持”能力。
5. Windows CI 通过只能证明 runner 环境中的自动化与打包成功；原生安装器交互、默认浏览器、重装/卸载和系统策略差异必须由 Windows 实机记录补齐。
