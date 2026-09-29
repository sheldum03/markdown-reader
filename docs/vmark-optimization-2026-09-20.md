# VMark 对照与第一阶段优化

本文保留第一阶段记录；第二阶段实现与最新验证见 [第二阶段验收](phase-two-acceptance.md)。

参考本机 `/Users/admin/Desktop/xp-important/Vmark`，版本 0.9.81，提交 `113ad8d1c5b419cc7d2698a753668eb7959070c7`。在线项目：[xiaolai/vmark](https://github.com/xiaolai/vmark)。本项目继续使用 Vue + Milkdown，保留 HTML 独立窗口、评论 sidecar、翻译和 AI 文档助手。

## 对照与实现

| 方向 | 本项目原状 | VMark 参考 | 本轮实现 |
| --- | --- | --- | --- |
| 首次打开 Markdown | 直接初始化完整富文本编辑器 | 大文件按体量选择打开路径，编辑器与渲染器按需加载 | 默认轻量阅读，选择编辑/分屏后才加载 Milkdown；切换模式保留编辑器实例 |
| 公式与图表 | 主线没有独立公式/图表阅读管线 | `plugins/latex/katexLoader.ts`、`plugins/mermaidPreview/mermaidPreviewRender.ts` | 本地依赖 KaTeX/Mermaid，进入视口附近才加载；失败保留源码 |
| 渲染缓存 | 无 | `utils/lruCache.ts` | 直接复用 ISC 缓存工具；8 份小文档、16 份小图表上限，超过体积限制不缓存 |
| 快速切换 | 先发请求晚返回可能覆盖新文档、评论 | Mermaid render token 避免过期结果覆盖 | 文件、工作区、评论、Worker、异步增强均检查当前请求或生命周期 |
| 大文档 | 解析/编辑都在主线程 | `services/navigation/largeFileRouting.ts` | 8 万 UTF-16 字符起使用 Worker；实时修改 160ms 防抖，取消旧 Worker；块级 content-visibility 减少离屏布局 |
| 标题大纲 | 行正则，会误判代码块 | 结构化 Markdown 管线 | 与阅读视图使用同一解析结果，支持 Setext、格式化标题，按源行生成唯一 ID |
| 阅读操作 | 编辑器内阅读 | 清晰的阅读/编辑分工与渲染反馈 | 阅读/编辑/分屏、专注阅读、字数/行数/预计阅读时间、代码复制、图表源码折叠、本地图片、脚注跳转 |
| 原生加载与保存 | 同步目录扫描；导出读取磁盘旧稿 | 延迟昂贵工作、明确状态边界 | 后台线程扫描目录；显示文件加载/失败状态；导出前等待保存；编辑器初始化状态与卸载清理 |

不迁移 VMark 的 React/Zustand/Tiptap 应用层；本轮复用范围与许可见根目录 `THIRD_PARTY_NOTICES.md`。许可证通过 `public/third-party/VMark-LICENSE.txt` 随构建产物分发。

## 验证

- 修改前：83 项前端测试、类型检查和生产构建通过。
- 修改后：100 项前端测试通过，包含渲染安全、标准语法、异步竞态、Worker 取消、按需编辑器、模式切换保存失败保护和预览组件测试。
- `pnpm typecheck` 通过；Rust 31 项测试通过。
- Chromium 生产构建检查：阅读、公式、Mermaid、代码高亮、分屏无页面错误；网络请求确认阅读模式不加载编辑器。
- 本机浏览器单次测量：小文档约 68ms 显示正文，约 28 万字符 / 5,000 章节文档约 244ms 显示正文。测试模拟了 Tauri 文件读取，属于显示路径采样，不包含真实磁盘读取，也不代表所有机器或所有文档的性能。
- 新增 `pnpm check:reading-bundle`：检查生产 manifest 的静态依赖闭包，阻止阅读路径提前加载编辑器、KaTeX、Mermaid 或 Prism。
- 原生 macOS WebView：6 条核心流程全部通过（包括新增的公式、图表、阅读批注和真实 Worker）；关闭后新进程重开的创建/恢复两阶段均通过。
- `git diff --check` 和 Rust 格式检查通过。

界面截图：[阅读模式](qa/vmark-reading.png)、[公式与图表](qa/vmark-diagrams.png)。

## 边界与后续优先级

1. Worker 避免主线程解析阻塞，最终 HTML 仍整体挂载；这不是千万字符级文档的完整虚拟化方案。主动切换编辑后仍受 Milkdown 富文本编辑器性能限制。
2. 阅读已支持公式、脚注等扩展语法；富文本编辑与 HTML 导出继续使用原有 Milkdown / Rust 管线，尚未统一全部扩展语法。包含这些扩展的复杂文档应先检查保存和导出效果；后续应增加保真源码编辑与统一导出管线。
3. 分屏预览会跟随内容更新，目前两侧独立滚动。编辑器的重复标题定位和跨格式选区的精确源映射仍可进一步增强。
4. Mermaid 的部分复杂图表引擎较大，构建会有分块体积提示；它们保留按需加载，不进入普通阅读首屏。
5. VMark 的多标签页、CodeMirror 源码编辑、MCP、全量 CJK 格式化没有移植。本轮优先补足本产品的阅读性能与已有业务流程可靠性。
6. 签名、公证和正式分发仍沿用项目原有发布流程，本轮功能验证不替代发布验收。
