# Markdown Reader

[中文](README.zh-CN.md) | English

> A local-first Markdown workspace for editing, reviewing, and exporting shareable HTML.

Markdown Reader is a macOS and Windows desktop app for people who write and review Markdown files. Open a folder you control, edit documents in place, leave anchored comments, then export a standalone HTML reading version. Core editing, comments, search, and export work without an account or API key.

## What you can do

- Read large Markdown documents with a virtual viewport; edit exact source in CodeMirror or use the optional WYSIWYG editor.
- Keep independent drafts in tabs, synchronize source/preview scrolling, and preview or undo CJK formatting.
- Connect an MCP client to an explicitly configured local workspace, with read-only access by default.
- View and edit YAML as raw text while preserving its syntax.
- Add anchored review comments stored separately from the source document.
- Search file names and workspace content.
- Export Markdown as standalone HTML, with an optional embedded source view.
- Generate a Chinese translation copy from the button beside **Rich text edit** in a Markdown document toolbar, or create an AI reading version when you explicitly configure and approve an AI provider.

## Try it in 30 seconds

1. Open a folder containing a Markdown or YAML file.
2. Select text and add a comment.
3. Open **Document tools** and export an HTML reading version.

No AI setup is needed for this path.

## Create a Chinese translation copy

Open a Markdown document, select a translation service in **Document tools**, then choose the translation button beside **Rich text edit**. Any pending changes are saved before a separate Chinese copy is created; the source document is not overwritten.

## Run locally

Requirements: macOS or Windows 10 22H2 / Windows 11 x64, Node.js 24+, pnpm 11.7.0, and Rust 1.96+. Windows development uses the `x86_64-pc-windows-msvc` Rust target and the Microsoft C++ build tools required by Tauri.

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

## Windows installer

The first Windows release target is Windows 10 22H2 and Windows 11 on x64 only. Build the per-user NSIS `setup.exe` on Windows with:

```powershell
pnpm install --frozen-lockfile
pnpm run tauri:build:windows
```

The installer does not require administrator access by default and uses Tauri's WebView2 `downloadBootstrapper` mode, so installation may require internet access when WebView2 is missing. The single installer includes English and Simplified Chinese. ARM64, 32-bit Windows, MSI, Microsoft Store packages, Windows 7/8, offline installers, and UNC network workspaces are outside this phase.

## Privacy and AI

The app works locally by default. Opening, editing, commenting, searching, and HTML export operate on the folder you choose.

AI tools are optional. Before creating an AI reading version or document-assistant request, the app asks for confirmation and sends only the current Markdown and, where needed, unresolved comments to the provider you choose. When you save OpenAI-compatible settings, the API key is stored in the current user's application configuration directory for reuse. See [PRIVACY.md](PRIVACY.md) for the storage and security details.

## Beta limitations

Ten-million-character native samples and phase-two regression results are documented in [Phase-two acceptance](docs/phase-two-acceptance.md). Generated formula/diagram selections require source mode for precise comment anchors. Keep a copy of important work and see [BETA_LIMITATIONS.md](BETA_LIMITATIONS.md) before relying on the app for critical workflows.

## Code signing policy

Windows preview releases are intentionally unsigned while the project does not
hold an Authenticode certificate. Windows may therefore show **Unknown
publisher** or a SmartScreen warning. A preview is never represented as signed;
downloaders should compare its SHA-256 digest with the release's
`SHA256SUMS.txt` before running it.

A stable Windows build will not be published until Authenticode signing is
configured. Official Windows release artifacts must be built from a protected
`v*` tag by GitHub Actions, and must be attached to the matching GitHub Release
by that workflow. A locally built or manually uploaded executable is not an
official release. Signing keys must be held outside the repository in a
hardware-backed or managed signing service and exposed only to the protected
release environment; maintainers must never commit or export a private key.

Current release roles for this single-maintainer project are:

- Maintainer: [@sheldum03](https://github.com/sheldum03) — repository and CI maintenance.
- Reviewer: [@sheldum03](https://github.com/sheldum03) — code and dependency review.
- Approver: [@sheldum03](https://github.com/sheldum03) — release-tag approval.

These roles are transparent but not independent while the project has one
maintainer. An additional reviewer should be added before a signed stable
release. All accounts with write, approval, or release authority must have MFA
enabled. Dependency redistribution findings are recorded in
[DEPENDENCY_LICENSE_REVIEW.md](DEPENDENCY_LICENSE_REVIEW.md).

## Release status

This is a desktop beta. The macOS application, DMG smoke path, and Tauri E2E have been verified locally on macOS. The Windows x64 GitHub Actions gate has completed successfully, covering type checks, frontend and Rust tests, Vite build, real Tauri E2E, NSIS build, and artifact upload; current runs are available in [GitHub Actions](https://github.com/sheldum03/md-html-reader/actions/workflows/ci.yml). The Windows 10/11 physical-machine checklist remains a release gate. Developer ID/notarization for macOS and Authenticode signing for stable Windows releases also remain external credential gates. See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Development checks

```bash
pnpm exec vue-tsc --noEmit
pnpm test -- --run
pnpm build
(cd src-tauri && cargo test)
pnpm run tauri:build:windows # Windows x64 only
```

## Product docs

- [Phase-two acceptance and limitations](docs/phase-two-acceptance.md)

- [Privacy statement](PRIVACY.md) · [中文](PRIVACY.zh-CN.md)
- [Beta limitations](BETA_LIMITATIONS.md) · [中文](BETA_LIMITATIONS.zh-CN.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Manual acceptance guide](MANUAL_ACCEPTANCE.md)
- [Windows 10/11 acceptance guide](WINDOWS_ACCEPTANCE.md)
- [Dependency redistribution review](DEPENDENCY_LICENSE_REVIEW.md)

## License

Released under the [MIT License](LICENSE).
