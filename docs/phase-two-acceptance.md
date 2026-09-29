# Markdown HTML Reader 第二阶段验收

本轮将上一阶段 b7efe56 快照三方合并到工作区起点 ddf7016，保留后续国际化、YAML、搜索与 AI 阅读版。未修改原目录、VMark 参考仓库或系统安装版。参考 VMark 0.9.81 / 113ad8d；直接迁移 CJK 格式化依赖闭包和 LRU，保留 ISC 声明。

## 五项验收矩阵

| 范围 | 已实现 | 验证证据 |
| --- | --- | --- |
| 超大文档 | 50 万字符起使用 Worker 块索引；视口只请求并挂载局部 HTML；测量块高并修正占位；源码编辑用 CodeMirror 的行虚拟化；编辑模式暂停预览解析，分屏更新防抖 | 千万字符从真实磁盘经 Tauri IPC 打开、跳到 80% 位置、挂载节点计数、源码打开与插入操作；原始数据 `qa/phase-two-native.json` |
| 保真与统一 | 默认保真源码；原文 CRLF 保留；无操作不写盘；阅读/导出共用 markdown-it 方言；导出静态 SVG、KaTeX 字体和本地图片；保留导出目录与源码分屏 | 特殊语法、CRLF 字符串往返、真实离线预览、既有导出不覆盖、工作区资源边界 |
| 分屏与定位 | 两侧按源行同步；用户输入解除程序滚动抑制；标题用源行 ID 区分；跨加粗/链接的选区映射；重复评论引用按距离重定位；评论侧栏定位原文 | 单元测试含第二次重复选区与引用；原生重复标题、双向同步和稳定位置验证 |
| 图表加载 | 保留引擎动态导入；按 Mermaid 已有模块、CodeMirror 包及布局引擎拆分；同源图表共享并发渲染；缓存 SVG 插入时重新分配 ID | 阅读依赖闭包检查、原生引擎加载标记、构建统计 `qa/phase-two-bundle.json`；没有提高 chunk 警告阈值 |
| VMark 功能适配 | 多标签保留实例/草稿/滚动/保存状态，逐标签关闭保护；CodeMirror 搜索/撤销/源码选区评论；完整 CJK 规则、设置、Worker 预览/应用/撤销；原生 stdio MCP | 前端标签隔离、原生 CJK 和草稿切换、真实 MCP 子进程读写/越界/符号链接/版本冲突；`qa/phase-two-mcp.json` |

## 验证命令

```sh
pnpm typecheck
pnpm test -- --run
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm check:reading-bundle
node scripts/analyze-bundle.mjs
pnpm test:e2e:build
pnpm test:e2e:core
pnpm test:e2e:reopen
pnpm test:e2e:phase-two
pnpm check:mcp
pnpm tauri:build
```

原生 E2E 只重建 Node `os.tmpdir()` 下名称含空格、中文和 `&^#` 的测试工作区（可用 `E2E_WORKSPACE_PATH` 覆盖）；测试应用 identifier 与生产版分离，前端输出使用 `dist-e2e/`。生产 App 构建在 `src-tauri/target/release/bundle/macos/MD+HTML Reader.app`。

可运行产物：[Apple Silicon macOS ZIP](../src-tauri/target/release/bundle/macos/MD-HTML-Reader-phase-two-macos.zip)，约 8.3 MiB，解压后打开 App。已补做本地 ad-hoc 签名并通过 `codesign --verify --deep --strict`；不是 Developer ID 公证发行包。ZIP SHA-256：`be798e86ef69f62248747408f5f11cedba621191e1d89e9b9970a56992168617`。构建产物保存在本机 target 目录，不提交到 Git。

最近一次跨平台适配后的本机结果：类型检查通过；前端 21 个测试文件、140 项通过；Rust 44 项通过；原生核心流程、图标、侧栏、跨进程重开和新增验收 4 项全部通过。MCP 使用真实 release 二进制分别验证只读和授权写入，两种模式各收到 7 条有效协议响应。既有回归覆盖 Markdown/HTML/YAML、评论、搜索、翻译配置和服务、AI 阅读版审批与写回、保存及关闭保护。WebDriver 退出时仍有测试服务清理 mock 的 session 警告，不影响用例结果。

## 性能与包体

详见原始 JSON，测量均为本机单次样本，不能推断其他硬件的分位数。原生性能样本通过真实磁盘/Tauri IPC/系统 WebView，不是模拟 IPC 浏览器采样。打开耗时包含点击、文件读取、解析和首屏挂载；滚动耗时覆盖跳转后的块更新；输入耗时包括 CodeMirror 插入事务与一次事件循环。16 ms 定时器最大间隔用于反映开文档期间主线程停顿，并非标准 Web Performance long-task 统计。

| 原生样本：10,000,619 字符 / 10,492,747 UTF-8 字节 | 测量值 |
| --- | ---: |
| 从磁盘打开到首屏 | 1,204 ms |
| 首屏挂载 | 7 块 / 62 DOM 节点 |
| 打开期间最大主线程定时器间隔 | 1,000 ms |
| 跳转到约 80% 位置后的块更新 | 4 ms / 101 DOM 节点 |
| 打开源码编辑器 | 98 ms / 55 DOM 节点 |
| 源码插入事务与事件循环 | 7 ms |
| 原生 RSS | 自动测试不跨平台猜测；按人工验收在系统任务管理器记录 |

以上性能来自 debug 原生测试包；release 包完成构建和 MCP 子进程验证，未将 debug 性能数字标成 release 基准。离线 HTML 样本为 394,232 字节，独立 WebView 中确认公式、SVG、图片可见且没有外部资源 URL。运行时加载标记显示纯文本阅读没有加载编辑/数学/图表/高亮引擎；当前 WebKit 的资源计时列表为空，不能单靠该列表证明没有请求。

RSS 不再由 E2E 调用平台专用的 `ps` 自动采集。Windows 请在任务管理器、macOS 请在活动监视器中记录应用及 WebView/WebContent 进程，并注明测量平台；不能把所有系统 WebView 进程简单相加算成本应用。大文件解析索引仍常驻 Worker 内存，DOM 虚拟化不等于恒定内存。

包体统计包含静态依赖闭包；SourceEditor/Mermaid 闭包可能与已加载阅读模块重叠，不能简单相加。同轮初次构建的 SourceEditor 单块约 531 KB、Milkdown 574 KB、Mermaid 核心 682 KB；拆分后编辑器/核心模块分散到可复用块。ELK 和 Mermaid parser 的上游单体库仍超过 500 KB，按需加载且保留构建告警。拆块不代表总代码体积按同等比例减少。

最终生产构建：应用外壳 161.9 KiB JS / 56.2 KiB gzip；外壳加阅读静态闭包 297.0 KiB / 110.6 KiB gzip；源码编辑闭包 823.7 KiB / 299.4 KiB gzip；Mermaid 入口闭包 674.8 KiB / 171.1 KiB gzip（不含按图形类型动态加载的布局模块）。最大按需块 ELK 1,438,482 字节，Mermaid parser 689,774 字节。阅读闭包隔离检查通过。

## MCP 使用

在已打开工作区点 **MCP → 生成配置**，将 JSON 加入客户端。配置里的 command 是实际应用二进制绝对路径；移动 App 后应重新生成。默认只暴露 list/read/search；勾选写入后在配置加入 `--allow-write`，才暴露 write。每次写入还须提交 read 返回的 SHA-256 revision。工作区和文档路径经 canonicalize 检查；符号链接逃逸与过期版本被拒绝。应用保存使用文件锁和旧内容比较，避免覆盖 MCP 更新。

服务采用 MCP 2024-11-05 的 [stdio 传输](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports) 和 [tools 协议](https://modelcontextprotocol.io/specification/2024-11-05/server/tools)。这是对本产品的磁盘工作区适配，不暴露 VMark 的浏览器自动化或整个 React/Tiptap 应用层。

## 已知边界

- Worker 仍完整解析一次文档，并保留 token 索引；千万字符读取时仍有可测的主线程 IPC/初始化停顿。没有宣称内存恒定或所有文档都无卡顿。
- 虚拟阅读遇到超过 32,000 字符的不可分块结构，使用每段最多 8,000 字符的源码切片。正常段落、表格、列表按语义块显示。普通 HTML 导出保持完整语义，不使用该阅读降级。
- 一百万字符以上、公式/脚注/Mermaid 文档使用源码编辑；富文本保留给适合的文档。分屏始终采用保真源码。
- 生成的公式/SVG 内部没有可逆的普通文本节点；对此不猜测评论偏移。需要精确评论公式/图表时使用源码选区。其他无法证明映射的选择同样不创建错误锚点。
- MCP 访问已保存的磁盘文档；不读取未保存标签草稿。会话标签不提供崩溃后的草稿恢复。已有自动/手动保存及关闭保护继续工作。
- 离线导出支持工作区内本地图片（单资源 ≤20 MiB），远程图片需先保存到工作区。导出渲染失败时保留源码与提示。
- App 未做 Developer ID 签名、公证；本轮产物用于本机测试，不作为已公证发行版。
