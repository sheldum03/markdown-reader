# Dependency redistribution review

Review date: 2026-09-29

Scope: dependencies resolved by `pnpm install --frozen-lockfile` for the production
frontend and by Cargo's default feature graph for the Windows desktop binary. Build,
test, and packaging tools are not shipped inside the installed application. The
Microsoft WebView2 bootstrapper embedded by the Windows installer is reviewed
separately below.

## Result

No dependency in the Windows installer was found to prohibit open-source binary
redistribution. The application itself is MIT licensed. The resolved dependency
set uses permissive licenses, public-domain-equivalent licenses, or the EPL-2.0
and MPL-2.0 weak-copyleft licenses described below.

This is a repository maintenance review, not legal advice. It must be repeated
whenever `pnpm-lock.yaml` or `src-tauri/Cargo.lock` changes before a release.

## Evidence

The Node production graph was inspected with:

```bash
pnpm licenses list --prod --json
```

It resolved 349 packages. The declared licenses were MIT, ISC, Apache-2.0,
BSD-2-Clause, BSD-3-Clause, PSF-2.0, Unlicense, compatible dual-license
expressions, one EPL-2.0 package (`elkjs` 0.9.3), and one package whose manifest
omits the SPDX field (`khroma` 2.1.0). `khroma` includes a complete MIT license
file in its published package, so the missing field is metadata rather than an
unknown redistribution term.

The Cargo default dependency graph was inspected from `src-tauri` with:

```bash
cargo metadata --format-version 1 --locked
```

It resolved 477 packages including the root package. The only weak-copyleft
entries are `cssparser` 0.36.0, `cssparser-macros` 0.6.1, `dtoa-short` 0.3.5,
`option-ext` 0.2.0, and `selectors` 0.36.1 under MPL-2.0. Other entries use
permissive licenses or offer a permissive option such as MIT or Apache-2.0.

## Microsoft WebView2 bootstrapper

The Windows bundle uses Tauri's `downloadBootstrapper` mode. It includes
Microsoft's small Evergreen WebView2 bootstrapper, not a fixed WebView2 Runtime,
and downloads the matching Evergreen Runtime when the target system needs it.
Microsoft's official WebView2 distribution documentation explicitly permits an
application to ship the Evergreen bootstrapper with the application. The release
review therefore found no redistribution blocker for this installer payload.

Sources:

- <https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution>
- <https://learn.microsoft.com/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version>

## EPL/MPL obligations

- `elkjs` is redistributed unmodified as a production dependency under
  EPL-2.0. Its exact source and license are available from
  <https://github.com/kieler/elkjs/tree/0.9.3> and the published npm package.
- The five MPL-2.0 Rust crates are used unmodified. MPL-2.0 applies at file
  level; their source and license remain available through the exact versions
  recorded in `src-tauri/Cargo.lock` and on <https://crates.io/>.
- Do not remove third-party copyright or license notices during bundling. If a
  covered dependency is modified, publish the modified covered files under its
  applicable license and update this review.

Project-specific copied code and its retained notice are documented in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
