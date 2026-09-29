# Windows 适配后期与发布计划

更新日期：2026-09-28

本文面向当前 `MD+HTML Reader` 的 Windows 10 22H2 / Windows 11 x64、NSIS 当前用户安装包。它承接仓库已有的 [Windows 实机验收清单](WINDOWS_ACCEPTANCE.md)、[测试指南](TESTING.md) 和 [发布清单](RELEASE_CHECKLIST.md)，重点回答适配完成后怎样走到可信、可维护的公开发布，以及开源项目是否必须做 Windows 代码签名。

## 先给结论：开源项目需要签名吗

**不是因为“开源”就必须签名，也不是因为“开源”就可以忽略签名。**

- 对当前从 GitHub Releases 或项目网站直接下载的 NSIS `setup.exe`，Windows/Tauri **不把 Authenticode 签名作为程序运行的绝对技术前提**。Tauri 官方明确说明，未签名应用仍可执行，前提是用户能够并愿意绕过 SmartScreen，或者文件不是经浏览器下载。[Tauri：Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- 这不等于未签名没有代价。微软说明，未签名下载通常会出现“Windows 已保护你的电脑”，用户要选择“仍要运行”；企业策略可能完全禁止继续。自签名证书对没有预装信任根的公众用户，与未签名的 SmartScreen 表现基本相同。[Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- Windows 11 的 Smart App Control 还可能直接阻止未知、未签名代码；它与浏览器下载时的 SmartScreen 信誉提示不是同一层机制。[Microsoft：Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview)
- “是否有法律义务”不能仅凭开源许可证或 Windows 文档作全球性结论。就本项目当前的普通桌面应用、直接下载分发方式而言，没有发现一条“开源软件必须签名”的通用 Windows 平台规则；特定国家、受监管行业、企业采购合同或应用商店条款可能另有要求，需要按实际分发地和客户合同判断。本文不是法律意见。
- 分发渠道会改变硬性要求：Microsoft Store 的 MSIX 路径由商店在认证后重签；若向 Store 提交传统 MSI/EXE，则安装器及其中的 PE 文件必须使用受信 CA 链的 Authenticode 证书签名。[Microsoft：Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) · [Microsoft：MSI/EXE package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)

因此，本项目建议采用下面的发布定义：

| 发布级别 | 签名要求 | 可以怎样描述 |
|----------|----------|--------------|
| 开发构建、本地测试 | 不需要 | development build，不对公众分发 |
| 小范围预览或 alpha | 可以暂不签 | 必须明确标注“未签名预览版”，说明 SmartScreen/策略拦截风险并提供 SHA-256 |
| 面向普通用户的正式稳定版 | 建议作为项目门禁要求签名 | “正式 Windows 版”；仍不得承诺完全没有 SmartScreen 提示 |
| Microsoft Store MSI/EXE | 必须 | 按 Store 对安装器和内部 PE 文件的签名要求执行 |
| Microsoft Store MSIX | 提交前不需要自购 CA 证书 | 通过认证后由 Microsoft 重签；这是另一套打包和发布工作 |

仓库当前的 `RELEASE_CHECKLIST.md` 已将 Authenticode 设为“正式 Windows 发布”的项目门禁。因此，在没有另行修改项目发布政策前，未签名产物应继续称为预览或内测构建，而不是正式稳定版。

## 不要对签名和 SmartScreen 作过度承诺

签名证明的是发布者身份和文件签名后未被篡改，不证明程序绝对安全，也不保证首次下载没有警告。

- 微软当前说明：有效 OV 或 EV 签名的首次下载仍可能因为信誉不足而显示“无法识别”；签名后会显示经过验证的发布者，并可用一致的签名身份逐步积累发布者信誉。[Microsoft：SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- 未签名文件的新版本需要分别从文件哈希信誉起步，不能依靠同一发布者身份跨版本积累信誉。
- **EV 证书自 2024 年起不再自动绕过 SmartScreen。** 不要仅为了“立即消除蓝窗”支付 EV 溢价，也不要在 README 或发布说明中承诺 OV、EV 或某个签名服务一定消除提示。[Microsoft：Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- UAC 与 SmartScreen 是不同机制。当前 `currentUser` 安装设计通常不需要提升权限，但组织策略或后续安装模式变化仍可能触发 UAC；签名不等于免除必要的权限提升。[Microsoft：How User Account Control works](https://learn.microsoft.com/en-us/windows-server/security/user-account-control/how-user-account-control-works)

## 当前仓库基线

| 领域 | 已有能力 | 尚缺证据或工作 |
|------|----------|----------------|
| CI | `windows-latest` 上配置了 frozen install、类型检查、前端/Rust 测试、真实 Tauri E2E、NSIS 构建和 artifact 上传 | Windows job 首次远端成功记录；失败重跑和产物复核记录 |
| 安装器 | x64 NSIS、当前用户安装、英文/简中、ICO、WebView2 `downloadBootstrapper` | Windows 10/11 实机安装、升级、卸载、代理/无网失败表现 |
| 应用行为 | Windows 路径、`Ctrl+S`、默认浏览器、MCP `.exe`、UNC 拒绝和特殊字符路径已进入自动化或命令层测试 | 原生目录/保存对话框、真实键鼠、系统浏览器和系统策略差异 |
| 签名 | 文档已把 Authenticode 列为外部门禁 | 尚未选择签名主体/服务；配置中没有 `signCommand`、证书指纹或时间戳配置；没有签名验证 job |
| 发布 | CI 能产生 unsigned `*-setup.exe` artifact | 没有受保护 tag 驱动的独立发布流、校验和、来源证明和正式 Windows Release |
| 更新 | 当前可通过下载安装包手动升级 | 未接入 Tauri Updater；没有更新密钥、更新清单和回滚策略 |

## 预览版交付形态：先分清四种“单 EXE”

用户说“直接打包成 `.exe`，一键启动”时，至少可能指四种不同东西：

1. 裸 Tauri 应用 EXE：双击后直接运行，不安装。
2. portable ZIP：下载 ZIP、解压，再双击其中的应用 EXE。
3. 自解压单 EXE：双击后先释放文件到临时或固定目录，再运行应用。
4. NSIS `setup.exe`：单个可下载的 EXE，但它是安装器；安装完成后运行已安装的应用。

这四者不能都简称“便携单 EXE”。对当前仓库，**主推现有 NSIS `setup.exe`，如确有需求再附带一个明确标注限制的 portable ZIP；不建议把裸 EXE 或自制自解压器作为普通用户唯一入口。**

### 四种方案对比

| 形态 | 双击体验 | WebView2 缺失时 | 安装/卸载与更新 | 当前项目数据落点 | 适合当前 preview |
|------|----------|-----------------|------------------|------------------|------------------|
| 裸 app EXE | 最接近“双击直接开” | 不能依靠当前 `downloadBootstrapper`；应用可能无法启动 | 无安装记录、快捷方式和卸载器；用户手工替换文件，Tauri Updater 的 Windows 标准产物不是裸 EXE | 仍写 `%APPDATA%\com.markdown-html.reader`，并直接读写用户选择的工作区，所以不是“零痕迹便携” | 仅作为高级用户附加包，且必须在无开发环境的干净系统验证 |
| portable ZIP | 需先解压；避免用户直接从压缩包内运行 | 若 ZIP 只有 app EXE，和裸 EXE 相同 | 删除解压目录只删除程序，不会自动清理 AppData；手工更新 | 与裸 EXE 相同 | 比直接散发裸 EXE 更清楚，可附 README/LICENSE，但仍不是完整便携模式 |
| 自解压单 EXE | 表面是一份 EXE，内部仍要释放和运行 | 要自行实现检测/安装 WebView2，或携带庞大 runtime | 要自行解决临时文件、进程生命周期、升级、清理和卸载；若写固定目录，本质上已是安装器 | 除非另做 portable 配置，否则仍写 AppData | 不推荐；重复实现 Tauri/NSIS 已有能力，新增验证面最大 |
| 当前 NSIS `setup.exe` | 下载物本身就是一个 EXE；双击进入安装流程，不是严格意义“一次点击直接开应用” | 安装器检测 runtime，缺失时联网下载并运行 bootstrapper | 当前用户安装、有标准卸载路径；以后可沿用 Tauri NSIS updater | 配置继续在 AppData，工作区不随卸载删除 | **推荐作为唯一必发主包** |

Tauri 官方将 Windows 发布物定义为 WiX `.msi` 或 NSIS `-setup.exe` 安装器；当前仓库选择的是后者。[Tauri：Windows Installer](https://v2.tauri.app/distribute/windows-installer/)

Tauri 官方 GitHub Action 虽可上传 `--no-bundle` 生成的 plain binary，但同时明确说明 Tauri 尚不正式支持 portable mode。因此 portable ZIP 应被视为本项目自行定义、测试和维护的附加发布物，不是换一个官方 bundle target 就能获得的保证。[Tauri Action：plain binary / portable mode](https://github.com/tauri-apps/tauri-action#uploading-plain-binaries)

### 裸 app EXE 在技术上可行，但不是无依赖

- Tauri CLI 的 `tauri build --no-bundle` 会跳过 bundling，即不生成 NSIS/MSI；它仍完成应用编译。当前仓库的 E2E build 也已使用 `--no-bundle` 生成真实应用二进制。[Tauri CLI：`--no-bundle`](https://v2.tauri.app/reference/cli/#build)
- 当前 `frontendDist` 指向本地 `dist` 目录。Tauri 会递归读取并把这些前端文件嵌入应用二进制，因此发布裸 EXE 时不需要把 `dist/` 目录另放在旁边。[Tauri Configuration：`frontendDist`](https://v2.tauri.app/reference/config/#frontenddist)
- Tauri Windows MSVC target 默认 `build.windows.staticVCRuntime: true`，即主应用默认静态链接 Visual C++ runtime。若以后加入未静态链接 CRT 的 sidecar 或 DLL，则仍要额外审计并可能使用 `bundleVCRuntime`；不能只根据主 EXE 启动成功就推断所有原生依赖都齐全。[Tauri Configuration：Windows build/runtime](https://v2.tauri.app/reference/config/#windowsbuildconfig)
- Tauri 不把平台 WebView 库包含进最终应用 EXE，而是在运行时使用 Windows 的 WebView2。因此“小 EXE”不等于“完全自包含”。[Tauri：Process Model](https://v2.tauri.app/concept/process-model/#the-webview-process)

所以，裸 EXE 的技术定义应是：**前端资源内嵌、主程序可单文件分发，但依赖目标机已有兼容的 Evergreen WebView2 Runtime。**

### 当前 `downloadBootstrapper` 对裸 EXE 不生效

`src-tauri/tauri.windows.conf.json` 中的 `webviewInstallMode: downloadBootstrapper` 属于 Windows bundler/installer 配置。Tauri 的行为是：安装器检查 runtime；缺失时下载 bootstrapper 并执行。`--no-bundle` 既然跳过安装器，就不会把这一流程附着到裸 app EXE 上。[Tauri：WebView2 Installation Options](https://v2.tauri.app/distribute/windows-installer/#webview2-installation-options)

微软要求分发 WebView2 应用时确保客户端存在 WebView2 Runtime，并建议在安装或更新阶段检测和部署。Windows 11 包含 Evergreen Runtime，绝大多数 Windows 10 设备也已有，但微软明确指出仍有少量 Windows 10 设备没有，不能据此删掉依赖处理。[Microsoft：Distribute your app and the WebView2 Runtime](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

当前可选模式的实际代价是：

| Tauri 模式 | 是否需要联网 | 安装器额外体积（Tauri 当前文档估算） | 对“裸单 EXE”的意义 |
|------------|--------------|--------------------------------------|----------------------|
| `downloadBootstrapper` | 是 | 0 MB | 只由安装器下载和运行；裸 app EXE 不获得此能力 |
| `embedBootstrapper` | 是 | 约 1.8 MB | 仍只是把小 bootstrapper 放进安装器，最终仍要联网 |
| `offlineInstaller` | 否 | 约 127 MB | 适合离线安装器，不会把 runtime 变成裸 app EXE 的一部分 |
| `fixedRuntime` | 否 | 约 180 MB | Tauri 把固定 runtime 文件打进安装器；runtime 本身是一组文件，不是轻量裸单 EXE，且安全更新责任转给项目 |
| `skip` | 否 | 0 MB | Tauri 明确警告：用户没有 runtime 时应用不会工作 |

微软同样说明 Fixed Version 需要把解压后的全部 runtime 二进制随应用部署并由开发者主动更新；这与“一个很小、无需维护的便携 EXE”目标相冲突。[Microsoft：Fixed Version distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#the-fixed-version-runtime-distribution-mode)

### “portable”不等于不写系统目录

当前应用把已保存的模型配置和 API key 写到 `%APPDATA%\com.markdown-html.reader\.env`，WebView 数据目录也由应用标识管理；同时它按用户明确选择的工作区直接读写 Markdown、评论 sidecar 和导出文件。因此即使程序本体从 U 盘或解压目录启动：

- 删除 EXE/ZIP 解压目录不会删除 AppData 配置；
- 移动 EXE 不会把设置自动带到另一台电脑；
- 当前 MCP 配置中的 `command` 由 `current_exe` 生成并记录应用 EXE 的绝对路径；移动裸 EXE 或 portable 解压目录后，旧 MCP 配置不会自动跟随，必须从新位置重新生成配置；
- 卸载或删除程序都不得误删用户工作区；
- 包装方式不会改变应用拥有当前用户文件权限、可写所选工作区这一安全边界，不应为便携版请求管理员权限。

若以后真的要做“数据随程序目录移动”的 portable flavor，需要单独设计 AppData/WebView data 的迁移和清理。Tauri 支持用 `appDirectoriesOverride` 为 portable build 指定独立子目录，但官方特别警告不要直接使用 `"./"`：过宽目录会扩大文件权限范围，并可能让受损 WebView 改写 EXE 相邻文件；应使用类似 `./app-data` 的专用子目录，而且只应用于 portable 构建配置。[Tauri Configuration：App directory overrides](https://v2.tauri.app/reference/config/#appdirectoryoverrides)

这项工作涉及凭据存储、升级和安全边界，**不应为了首个 preview 临时改动**。当前 portable ZIP 若提供，必须如实称为“免安装程序包”，不能宣称“完全便携/零痕迹”。

### 更新、卸载、SmartScreen 与签名

- 裸 EXE 和 portable ZIP 没有安装记录或卸载器。用户删除程序文件后，AppData 配置仍可能保留，需要在说明中给出手工清理位置。
- NSIS 负责把应用装入当前用户的 `%LOCALAPPDATA%`，默认不要求管理员权限，并提供安装/卸载语义。[Tauri：NSIS install modes](https://v2.tauri.app/distribute/windows-installer/#install-modes)
- Tauri Updater 在 Windows 上复用 NSIS/MSI 安装器作为标准更新 bundle，并强制校验 updater signature；当前文档没有把裸 app EXE列为标准 Windows updater artifact。因此首个 preview 不应承诺裸 EXE 自动更新。[Tauri：Updater building](https://v2.tauri.app/plugin/updater/#building)
- 把 app EXE 放进 ZIP 或自解压器不会绕过 SmartScreen。公开分发时应签名最终会执行的 app EXE；NSIS 路径还应验证外层 `setup.exe`、安装后的主 EXE 和卸载器/其他 PE 文件。未签名 preview 的四种形态都要明确披露 SmartScreen 风险。
- 自解压 EXE 如果只是释放文件后运行，既没有当前 Tauri NSIS 的依赖检查，也没有天然卸载/更新优势。NSIS 本来就编译为单个 installer executable，并支持生成 uninstaller；再套一层自解压器只会增加需要签名和验收的代码路径。[NSIS：Command Line Usage](https://nsis.sourceforge.io/Docs/Chapter3.html) · [NSIS：WriteUninstaller](https://nsis.sourceforge.io/Reference/WriteUninstaller)

### 对首个 Windows preview 的选择

**推荐发布一个必选主包，最多再加一个可选副包：**

1. 主包：现有 x64 current-user NSIS `*-setup.exe`。它已经是“单个下载文件”，可处理 WebView2 缺失、有卸载路径，最适合普通测试者。
2. 可选副包：`MD-HTML-Reader-vX.Y.Z-windows-x64-portable.zip`，内含由同一提交构建的 app EXE、LICENSE 和简短说明。若已有 Authenticode，则对内部 EXE 验签；若 preview 暂不签名，则显著标注 `unsigned preview`，同时发布 SHA-256 和 commit。仅在 Windows 10/11 干净机器确认无遗漏 DLL、已有 WebView2 时正常启动后发布；说明它免安装但会写 AppData、无自动更新、缺少 WebView2 时不能自修复，移动后还要重新生成 MCP 配置。
3. 不单独发布散装裸 EXE：ZIP 可以减少“这是不是安装器”的歧义，容纳许可证和限制说明；两者技术依赖相同。
4. 不做临时自解压运行器：如果目标是一个下载文件，NSIS 已经满足；如果目标是完全免安装，自解压到临时目录并没有解决 AppData、WebView2、更新和清理问题。

当前配置启用了中英语言选择器，正常 NSIS wizard、WebView2 下载及可能的 SmartScreen 都意味着它不是字面意义的“只点击一次”。若产品目标只是“用户下载一个 `.exe`，双击后按向导完成”，现有 NSIS 已满足；若目标严格是“双击立即出现主窗口且绝不安装”，只能接受裸 EXE 对 WebView2、卸载和更新的上述限制，不能同时声称完全自包含。

## 优先级总表

这里的“必须”指满足仓库当前“正式 Windows 稳定版”定义所需；它不表示 Windows 法律普遍强制。

### 必须：首次正式 Windows 发布前

1. 让当前 Windows CI 在目标提交上完整成功，并保存 run URL、提交 SHA 和安装器 artifact 名称。
2. 分别完成 Windows 10 22H2 x64 与 Windows 11 x64 实机验收；问题修复后只重测受影响项不够时，应重新跑完整安装/升级/卸载路径。
3. 明确 Windows 10 的支持措辞。Windows 10 22H2 已于 2025-10-14 结束常规支持；若继续覆盖，应写成“兼容性测试目标”，不能暗示操作系统仍受 Microsoft 常规安全支持。[Microsoft：Windows 10 lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro)
4. 选择并记录签名方案、证书显示的 Publisher、资格主体、费用、密钥托管、时间戳和撤销负责人。
5. 对最终应用 EXE、NSIS 安装器以及安装/卸载链路涉及的可执行文件完成受信 Authenticode 签名和验证。
6. 建立只从受保护版本 tag 运行的发布流程；发布的必须是经过测试、签名和验证的同一字节文件，不得在签名后重新打包或修改。
7. 发布 SHA-256、提交 SHA、最低系统/架构、联网安装约束、已验证的 Publisher 和已知限制。

### 建议：正式发布同时完成

1. 将普通 CI 与有签名权限的 release workflow 分离；PR 和普通 push 永远接触不到签名身份。
2. 为公开发布产物生成 GitHub artifact attestation，提供可验证的构建来源。它是 Authenticode 的补充，不替代 Windows 发布者签名，也不证明软件无漏洞。[GitHub：Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
3. 将 workflow 中第三方 action 从可移动 tag 固定到完整 commit SHA；GitHub 将完整 SHA 描述为 action 不可变引用的方式。[GitHub：Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
4. 增加版本一致性门禁，确保 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 和 Git tag 使用同一版本。
5. 在发布说明提供“如何查看数字签名”和 `gh attestation verify`/SHA-256 校验方法。
6. 建立证书到期、撤销和签名服务不可用时的响应预案。

### 可延期：第一版稳定后单独立项

1. ARM64、32 位、MSI、离线 WebView2、UNC 网络工作区。
2. Microsoft Store/MSIX。当前项目是 NSIS `downloadBootstrapper` 在线安装；Store 的传统 MSI/EXE 路径要求 standalone/offline installer，因此不能直接把现有包原样当作 Store 提交物。[Microsoft：MSI/EXE package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
3. 自动更新。Tauri Updater 的更新签名是单独的应用级签名体系，验证不能关闭，私钥丢失会导致已安装客户端无法接收后续更新；它不能替代 Authenticode。[Tauri：Updater signing](https://v2.tauri.app/plugin/updater/#signing-updates)
4. 企业集中部署、Intune/App Control for Business 策略验证。

## 分阶段执行计划

### 阶段 0：确定发布口径和系统范围

目标：避免工程完成后仍无法决定发布物叫什么。

- 决定近期发布是“未签名公开预览”还是“已签名稳定版”。
- 若先发未签名预览版，在 Release 顶部直说可能出现 SmartScreen 或企业策略拦截，附提交 SHA 和 SHA-256；不要教用户全局关闭安全功能。
- 对 Windows 10 22H2 保留实机测试，但在文档中说明它已结束 Microsoft 常规支持。WebView2 Runtime 目前承诺在 Windows 10 22H2 上至少更新至 2028-10；这只说明 WebView2 生命周期，不恢复 Windows 10 操作系统本身的安全支持。[Microsoft Edge/WebView2 lifecycle](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-support-lifecycle)
- Windows 11 使用最新完整补丁的受支持版本验收，并记录具体 edition、version、OS build、WebView2 version，而不是只写“Windows 11”。

验收证据：一次维护者决策记录，写明发布级别、系统范围、签名路线和明确不支持项。

### 阶段 1：取得可重复的 Windows CI 基线

目标：证明当前提交能在真实 Windows runner 从干净环境构建和测试。

1. 推送当前适配提交，确认 Windows job 的安装、类型检查、单元测试、Vite build、Rust target 测试、Tauri E2E 和 NSIS build 全部成功。
2. 下载 `windows-nsis-x64` artifact，在 Windows 主机记录：文件名、大小、SHA-256、Git SHA、Tauri/Rust/Node/pnpm 版本。
3. 确认 artifact 中只有预期安装器，没有 `.env`、测试工作区、日志、PFX、私钥或 API key。
4. 增加版本一致性检查和安装器文件存在性检查；签名前允许产物是 unsigned，但必须清楚标记。
5. 给 `.github/workflows/` 配置 CODEOWNERS 或等效审查规则，并固定 action 完整 SHA。

验收证据：首个绿色 Windows Actions run 链接、安装器 SHA-256 和产物内容检查记录。

### 阶段 2：完成 Windows 实机与安装器验证

目标：补齐自动化刻意绕过的系统交互。

按 `WINDOWS_ACCEPTANCE.md` 在两套独立环境执行，至少包含：

- Windows 10 22H2 x64：明确标为兼容性测试环境，并记录是否加入 ESU。
- Windows 11 x64：全新、完整补丁环境；如机器允许，另测 Smart App Control 开启时的行为。
- WebView2 已存在、WebView2 缺失并可联网、代理/防火墙阻断、断网四种情况。当前 `downloadBootstrapper` 本来就不是离线方案，失败时至少不能损坏已有安装。
- 普通用户账户安装，确认默认路径不需要管理员权限；再在企业策略较严格的机器上观察差异。
- 全新安装、同版本重装、旧版升级、新版卸载；工作区和评论 sidecar 不得被卸载器删除。
- 含空格、中文、`&^#` 的本地路径；CRLF；默认浏览器；真实 `Ctrl+S`；原生目录和保存对话框；MCP `.exe` 配置。
- 记录 `%APPDATA%\com.markdown-html.reader` 的保留行为；卸载不会自动等于清除 API key，文档必须与实测一致。

验收证据：填写完成的 Windows 10/11 表、截图或短视频、安装日志和每个阻塞问题的复现步骤。不要把 CI 成功替代为实机成功。

### 阶段 3：选择签名路径

按以下顺序评估，不需要因为开源而直接购买最贵证书。

#### 路径 A：SignPath Foundation 免费开源签名

这是本项目最值得先申请的路径，但不是自动获批。

- SignPath Foundation 为符合条件的开源项目提供免费签名，私钥保存在 HSM 中；证书的发布者会显示 **SignPath Foundation**，不是项目名或维护者姓名。[SignPath Foundation](https://signpath.org/)
- 官方条件包括 OSI 许可、无专有组件、项目活跃且已有发布、仓库和发布页文档完整、团队启用 MFA、明确 author/reviewer/approver 角色、可验证构建以及每次签名人工批准。[SignPath Foundation conditions](https://signpath.org/terms.html)
- 当前仓库使用 MIT License，但是否满足“已有发布、无专有组件和可验证构建”等全部条件，应由申请材料和 SignPath 审核决定，不能在获批前当作既成事实。

适合：愿意接受 `SignPath Foundation` 作为 Publisher、能满足治理要求、希望降低证书成本的开源项目。

#### 路径 B：Microsoft Artifact Signing

Artifact Signing 是曾称 Trusted Signing / Azure Code Signing 的当前服务名，也是微软推荐的非 Store 分发签名服务。[Microsoft：Artifact Signing overview](https://learn.microsoft.com/en-us/azure/artifact-signing/overview)

- 由 Microsoft 托管证书和 HSM 生命周期，可接入 SignTool、GitHub Actions 等签名工具。
- 公开分发要使用 Public Trust 证书配置，不应误用 Private Trust 或测试配置。
- 先核对申请资格：微软当前公开列表中，组织支持美国、加拿大、欧盟、英国、澳大利亚、新西兰、日本、韩国、新加坡、瑞士、挪威和以色列；个人开发者只支持美国和加拿大。若申请主体位于中国大陆，当前列表未覆盖，不能把此路径当作默认一定可用。[Microsoft：Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- 如果采用 GitHub Actions，优先使用 OIDC/联合身份获取短期令牌，不保存长期 Azure client secret；将信任条件限制到本仓库和 release 环境。[GitHub：OIDC in Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure) · [Microsoft/Azure action：OIDC](https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md)

适合：资格地区内、希望显示自身经验证法定身份并将签名托管进 CI 的维护者或组织。

#### 路径 C：传统商业 OV 代码签名

- 选择证书链进入 Microsoft Trusted Root Program 的代码签名服务，并核对主体资格、Publisher 显示名、HSM/硬件 token 或云签名方式、CI 支持、时间戳、续期和撤销响应。
- 2023-06-01 后公开信任代码签名私钥有硬件保护要求；Tauri 官方也警告其把 PFX 导入 GitHub runner 的旧 OV 示例仅适用于该日期前取得的证书。新方案不应默认把新证书导出为 base64 PFX 长期存进 GitHub Secret。[Tauri：OV certificate warning](https://v2.tauri.app/distribute/sign/windows/#ov-certificates) · [Microsoft：Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- OV 与 EV 对当前 SmartScreen 的信誉建立效果相同；只有企业采购或其他身份审核确实需要 EV 时才考虑 EV。

适合：不符合 SignPath/Artifact Signing 资格，或必须显示自己的法定 Publisher。

#### 路径 D：Microsoft Store MSIX

- Store MSIX 通过认证后由 Microsoft 重签，不需要维护者自行购买公开信任证书；微软将其列为大多数新 Windows 应用的推荐分发路径。[Microsoft：Code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- 这需要新增 MSIX 打包、Store 认证、更新和双渠道安装冲突处理，不是给现有 NSIS 文件补一个开关，应独立立项。

适合：希望依赖 Store 分发和签名、愿意承担新的打包与审核渠道成本。

### 阶段 4：实现安全的签名发布流水线

目标：签名身份只用于经过审核的正式版本，且发布物与验收物完全一致。

建议新建独立 release workflow，顺序固定为：

`受保护版本 tag → 干净构建 → 全量测试 → 签名 → 时间戳 → 验签 → 哈希/来源证明 → 实机抽检 → GitHub Release`

具体要求：

1. 仅允许受保护的 `v*` tag 或人工 release 触发签名，不允许普通 `pull_request`、fork PR 或任意分支取得签名权限。
2. 使用 `release-signing` GitHub Environment，限制可部署 tag，配置 required reviewer，并在团队人数允许时禁止发起者自批；environment secrets 只有通过保护规则后才会交给 job。[GitHub：Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
3. 维持最小权限。一般构建只需 `contents: read`；OIDC 签名 job 额外使用 `id-token: write`，不要给整个 workflow 无关写权限。
4. 若签名服务支持 OIDC，使用短期令牌和精确的 federated subject；若只能用 secret，则使用 environment secret、最小权限、定期轮换并避免出现在日志。
5. Tauri 支持 `bundle.windows.signCommand` 接入外部签名工具。无论采用内置 SignTool 还是外部服务，都要确认打包过程中的应用 EXE 和最终 NSIS `setup.exe` 均被签名，而不是只签外层安装器。[Tauri：Custom sign command](https://v2.tauri.app/distribute/sign/windows/#custom-sign-command)
6. 使用 SHA-256 文件摘要和 RFC 3161 时间戳。微软 SignTool 文档要求显式指定文件摘要和时间戳摘要算法，并推荐 SHA-256。[Microsoft：SignTool](https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe)
7. 每个待发布 EXE 至少执行 `signtool verify /pa /v <file>`，将非零退出码设为发布失败；同时人工核对 Publisher、证书链和时间戳。[Microsoft：Verify a file signature](https://learn.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-verify-a-file-signature)
8. 签名后不得再修改、压缩重建或替换安装器。哈希、attestation 和 Release 上传都必须引用验签通过的同一文件。
9. 为公开仓库生成 GitHub artifact attestation；验证示例由发布说明给出。GitHub 明确提醒 attestation 只建立来源和构建关联，不保证产物安全。[GitHub：Using artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)

签名流水线验收证据：

- `signtool verify /pa /v` 对安装器和已安装主程序均成功。
- 文件属性“数字签名”页显示预期 Publisher 和可信时间戳。
- 发布页 SHA-256 与下载后本地计算值一致。
- 公开 tag、commit、workflow run、attestation 和安装器可以相互追溯。
- PR、普通 push 和未审批 job 无法调用签名身份。

### 阶段 5：候选版与公开发布

1. 从 release workflow 生成 `vX.Y.Z-rc.1` 候选版，不从开发者本机另打包。
2. 用 Edge 从真实公开 URL 下载，分别观察 SmartScreen 开启和企业策略环境；记录实际文案、Publisher 和是否允许继续。
3. 签名候选版仍可能出现“无法识别”，这是正常的信誉建立阶段，不要因此改签名身份或反复生成内容不同的同版本安装器。
4. 在两套系统上完成安装、升级、卸载和核心功能抽检后，提升为正式 Release；若正式 tag 会重新构建，必须重新完成验签和最小安装抽检。
5. Release notes 至少包含：
   - Windows 11 x64 与 Windows 10 22H2 兼容性范围；
   - Windows 10 已结束常规系统支持的提示；
   - 当前用户 NSIS、可能联网下载 WebView2；
   - Publisher 名称和查看签名的方法；
   - SHA-256、源码 commit、attestation 验证方法；
   - ARM64、32 位、MSI、Store、离线安装和 UNC 不支持；
   - 已知 SmartScreen 信誉提示不能保证消失。

### 阶段 6：发布后的维护

每次版本：

- 使用同一受信发布者身份签名所有正式版本；签名失败、时间戳失败或 Publisher 变化时停止发布。
- 重跑 Windows CI、验签、升级安装和卸载抽检；涉及文件系统、对话框、浏览器打开或安装配置时扩大实机回归范围。
- 发布相同格式的 SHA-256、attestation、系统范围和限制说明。

每月或依赖更新批次：

- 复核 Tauri、WebView2、Rust、Node/pnpm 和前端依赖安全更新；保持锁文件评审。
- 抽查 Windows runner 镜像变化是否改变 SDK、SignTool、WebView2 或 NSIS 行为。
- 复核 Actions 引用 SHA、OIDC subject 和 release environment 权限。

每季度或证书事件前：

- 检查签名服务账户、身份验证、计费、证书配置和时间戳可用性。
- 至少提前一个发布周期演练续期；保持 Publisher 身份一致，避免无计划更换签名身份导致信誉重新积累。
- 建立私钥/签名身份泄露、错误签名和证书撤销流程：停止发布、撤销或禁用签名配置、发布安全公告、替换凭据并重新验证流水线。
- 复核 Windows 10 兼容性承诺。WebView2 在 Windows 10 22H2 的当前支持承诺到至少 2028-10，但应随微软生命周期更新重新评估，而不是预先承诺无限期支持。

## 推荐给本项目的现实路线

1. **现在**：先让现有 Windows CI 首次完整变绿，并完成两套实机清单；preview 主包继续使用当前单文件 NSIS `setup.exe`。若额外提供 portable ZIP，把它作为有明确限制的副包验收，不用它替代安装器。
2. **签名选择**：先评估 SignPath Foundation 免费 OSS 通道。它最符合开源项目成本结构，但需接受 Publisher 为 SignPath Foundation 并满足其治理条件。
3. **若 SignPath 不合适**：根据维护者/组织注册地核对 Artifact Signing Public Trust 资格。若主体位于中国大陆，当前官方地区列表不覆盖，应直接比较支持本地区的传统 OV/HSM 或云签名服务，不要把不可申请的 Azure 路线写进关键路径。
4. **若暂时不投入签名**：可以发布明确标注的 unsigned preview，附 SHA-256、源码 commit 和安装警告；继续把“正式稳定版”保持为未完成。
5. **后续渠道**：当 Windows 用户量和维护能力证明值得投入时，再评估 Store/MSIX 和 Tauri Updater。二者都是独立项目，不应阻塞第一版 NSIS 预览验证。

一句话决策：**公开面向普通用户，建议签；只因开源并不强制签，也不豁免安全提示。不要为了 SmartScreen 神话购买 EV，也不要把“已签名”写成“必定无警告”。**

## 一手资料索引

- [Tauri：Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri：Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri：CLI build / `--no-bundle`](https://v2.tauri.app/reference/cli/#build)
- [Tauri：Configuration](https://v2.tauri.app/reference/config/)
- [Tauri：Updater](https://v2.tauri.app/plugin/updater/)
- [Microsoft：Distribute your app and the WebView2 Runtime](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)
- [Microsoft：Code signing options for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft：Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview)
- [Microsoft：Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/)
- [Microsoft：SignTool](https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe)
- [Microsoft：Windows 10 lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro)
- [GitHub：Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub：Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [NSIS：Command Line Usage](https://nsis.sourceforge.io/Docs/Chapter3.html)
- [NSIS：WriteUninstaller](https://nsis.sourceforge.io/Reference/WriteUninstaller)
- [SignPath Foundation：OSS conditions](https://signpath.org/terms.html)
