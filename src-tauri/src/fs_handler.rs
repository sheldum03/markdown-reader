use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::{command, AppHandle, Manager};

use crate::path_guard::{
    document_file_in_workspace, is_ignored_name, is_supported_document_path, workspace_root,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub extension: Option<String>,
    pub title: Option<String>,
    pub children: Option<Vec<FileItem>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-fs-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn creates_markdown_files_in_the_workspace_root_without_overwriting() {
        let workspace = unique_test_root("create-markdown");
        fs::create_dir_all(&workspace).unwrap();
        let workspace_path = workspace.to_string_lossy().to_string();

        let created = create_markdown_file(workspace_path.clone(), "Release notes".to_string())
            .unwrap();

        assert_eq!(
            created,
            fs::canonicalize(workspace.join("Release notes.md"))
                .unwrap()
                .to_string_lossy()
        );
        assert_eq!(fs::read_to_string(&created).unwrap(), "");
        assert!(create_markdown_file(workspace_path.clone(), "Release notes.md".to_string()).is_err());
        assert!(create_markdown_file(workspace_path.clone(), "   ".to_string()).is_err());
        assert!(create_markdown_file(workspace_path.clone(), "../outside".to_string()).is_err());
        assert!(create_markdown_file(workspace_path, ".hidden".to_string()).is_err());

        fs::remove_dir_all(workspace).unwrap();
    }

    #[test]
    fn deletes_only_markdown_files_inside_the_workspace() {
        let workspace = unique_test_root("delete-markdown");
        let outside = unique_test_root("delete-outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let markdown = workspace.join("note.md");
        let html = workspace.join("page.html");
        let external = outside.join("external.md");
        fs::write(&markdown, "# Note").unwrap();
        fs::write(&html, "<h1>Page</h1>").unwrap();
        fs::write(&external, "# External").unwrap();

        let workspace_path = workspace.to_string_lossy().to_string();
        delete_markdown_file(workspace_path.clone(), markdown.to_string_lossy().to_string()).unwrap();

        assert!(!markdown.exists());
        assert!(delete_markdown_file(workspace_path.clone(), html.to_string_lossy().to_string()).is_err());
        assert!(delete_markdown_file(workspace_path, external.to_string_lossy().to_string()).is_err());

        fs::remove_dir_all(workspace).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn read_and_write_require_paths_inside_workspace() {
        let workspace = unique_test_root("workspace");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let allowed = workspace.join("note.md");
        let blocked = outside.join("secret.md");
        fs::write(&allowed, "allowed").unwrap();
        fs::write(&blocked, "blocked").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        let allowed = allowed.to_string_lossy().to_string();
        let blocked = blocked.to_string_lossy().to_string();

        assert_eq!(
            read_file(workspace.clone(), allowed.clone()).unwrap(),
            "allowed"
        );
        assert!(read_file(workspace.clone(), blocked.clone()).is_err());

        write_file(workspace.clone(), allowed.clone(), "updated".to_string()).unwrap();
        assert_eq!(fs::read_to_string(&allowed).unwrap(), "updated");
        assert!(write_file(workspace, blocked.clone(), "leaked".to_string()).is_err());
        assert_eq!(fs::read_to_string(blocked).unwrap(), "blocked");
    }

    #[test]
    fn list_files_skips_hidden_special_and_symlink_entries() {
        let workspace = unique_test_root("scan");
        fs::create_dir_all(workspace.join("node_modules")).unwrap();
        fs::create_dir_all(workspace.join(".hidden")).unwrap();
        fs::write(workspace.join("visible.md"), "visible").unwrap();
        fs::write(workspace.join("node_modules").join("dep.md"), "dep").unwrap();
        fs::write(workspace.join(".hidden").join("secret.md"), "secret").unwrap();

        #[cfg(unix)]
        {
            let outside = unique_test_root("outside-link");
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("linked.md"), "linked").unwrap();
            std::os::unix::fs::symlink(outside.join("linked.md"), workspace.join("linked.md"))
                .unwrap();
        }

        let files = list_workspace_files(workspace.to_string_lossy().to_string()).unwrap();
        let names: Vec<_> = files.iter().map(|item| item.name.as_str()).collect();

        assert_eq!(names, vec!["visible.md"]);
    }

    #[test]
    fn list_files_extracts_document_titles() {
        let workspace = unique_test_root("titles");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(
            workspace.join("note.md"),
            "intro\n\n# Markdown Title\n\ncontent",
        )
        .unwrap();
        fs::write(
            workspace.join("page.html"),
            "<!doctype html><html><head><title>HTML Title</title></head><body><h1>Fallback</h1></body></html>",
        )
        .unwrap();
        fs::write(
            workspace.join("fallback.html"),
            "<!doctype html><html><body><h1>Heading Fallback</h1></body></html>",
        )
        .unwrap();

        let files = list_workspace_files(workspace.to_string_lossy().to_string()).unwrap();
        let markdown = files.iter().find(|item| item.name == "note.md").unwrap();
        let html = files.iter().find(|item| item.name == "page.html").unwrap();
        let fallback = files
            .iter()
            .find(|item| item.name == "fallback.html")
            .unwrap();

        assert_eq!(markdown.title.as_deref(), Some("Markdown Title"));
        assert_eq!(html.title.as_deref(), Some("HTML Title"));
        assert_eq!(fallback.title.as_deref(), Some("Heading Fallback"));
    }

    #[test]
    fn list_files_includes_yaml_documents() {
        let workspace = unique_test_root("yaml");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(workspace.join("config.yaml"), "enabled: true").unwrap();

        let files = list_workspace_files(workspace.to_string_lossy().to_string()).unwrap();

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "config.yaml");
        assert_eq!(files[0].extension.as_deref(), Some(".yaml"));
    }

    #[test]
    fn read_file_decodes_declared_legacy_html() {
        let workspace = unique_test_root("legacy-encoding");
        fs::create_dir_all(&workspace).unwrap();
        let page = workspace.join("legacy.htm");
        let (encoded, _, _) = encoding_rs::GBK
            .encode("<html><head><meta charset=\"gbk\"></head><body>中文页面</body></html>");
        fs::write(&page, encoded.as_ref()).unwrap();

        let content = read_file(
            workspace.to_string_lossy().to_string(),
            page.to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(content.contains("中文页面"));
    }

    #[test]
    fn read_file_decodes_utf16_bom() {
        let workspace = unique_test_root("utf16-encoding");
        fs::create_dir_all(&workspace).unwrap();
        let page = workspace.join("legacy.xhtml");
        let encoded = "<html><body>UTF-16 页面</body></html>"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        let mut bytes = vec![0xFF, 0xFE];
        bytes.extend_from_slice(&encoded);
        fs::write(&page, bytes).unwrap();

        let content = read_file(
            workspace.to_string_lossy().to_string(),
            page.to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(content.contains("UTF-16 页面"));
    }
}

#[command]
pub async fn list_files(app: AppHandle, path: String) -> Result<Vec<FileItem>, String> {
    let root_path = workspace_root(&path)?;
    let scan_path = root_path.clone();
    let files = tauri::async_runtime::spawn_blocking(move || scan_directory(&scan_path))
        .await
        .map_err(|error| format!("扫描工作区失败: {}", error))??;
    app.state::<tauri::Scopes>()
        .allow_directory(&root_path, true)
        .map_err(|error| format!("授权 HTML 预览资源失败: {}", error))?;
    crate::html_preview_protocol::allow_workspace(&app, &root_path)?;
    Ok(files)
}

pub fn list_workspace_files(path: String) -> Result<Vec<FileItem>, String> {
    let root_path = workspace_root(&path)?;
    scan_directory(&root_path)
}

fn scan_directory(path: &Path) -> Result<Vec<FileItem>, String> {
    let mut items = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和特殊目录
        if is_ignored_name(&name) {
            continue;
        }

        if file_type.is_dir() {
            let children = scan_directory(&path).ok();
            items.push(FileItem {
                name,
                path: path.to_string_lossy().to_string(),
                file_type: "directory".to_string(),
                extension: None,
                title: None,
                children,
            });
        } else if file_type.is_file() {
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| format!(".{}", s));

            // 只包含受支持的 Markdown、HTML 和 YAML 文件
            if is_supported_document_path(&path) {
                items.push(FileItem {
                    name,
                    path: path.to_string_lossy().to_string(),
                    file_type: "file".to_string(),
                    extension,
                    title: extract_document_title(&path),
                    children: None,
                });
            }
        }
    }

    // 按类型和名称排序：目录在前，文件在后
    items.sort_by(|a, b| match (&a.file_type[..], &b.file_type[..]) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(items)
}

#[command]
pub fn read_file(workspace_path: String, path: String) -> Result<String, String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    read_document_content(&path)
}

#[command]
pub fn write_file(workspace_path: String, path: String, content: String) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}

fn markdown_file_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    let path = Path::new(name);
    let is_single_file_name = path.components().count() == 1
        && path.file_name().and_then(|file_name| file_name.to_str()) == Some(name)
        && !name.contains(['/', '\\']);

    if name.is_empty() || !is_single_file_name || is_ignored_name(name) {
        return Err("文件名无效。请使用工作区根目录下的普通文件名。".to_string());
    }

    if name
        .rsplit_once('.')
        .map(|(_, extension)| extension.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
    {
        Ok(name.to_string())
    } else {
        Ok(format!("{}.md", name))
    }
}

#[command]
pub fn create_markdown_file(workspace_path: String, name: String) -> Result<String, String> {
    let root = workspace_root(&workspace_path)?;
    let file_name = markdown_file_name(&name)?;
    let path = root.join(file_name);

    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| format!("新建 Markdown 文件失败: {}", error))?;

    Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn delete_markdown_file(workspace_path: String, path: String) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let is_markdown = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"));

    if !is_markdown {
        return Err("只允许删除 Markdown 文件".to_string());
    }

    fs::remove_file(&path).map_err(|error| format!("删除 Markdown 文件失败: {}", error))
}

fn extract_document_title(path: &Path) -> Option<String> {
    let content = read_title_sample(path)?;
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("md") => extract_markdown_title(&content),
        Some("html" | "htm" | "xhtml") => extract_html_title(&content),
        _ => None,
    }
}

fn read_title_sample(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut buffer = vec![0; 64 * 1024];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);
    Some(decode_document_bytes(&buffer))
}

pub fn read_document_content(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("读取文件失败: {}", error))?;
    Ok(decode_document_bytes(&bytes))
}

fn decode_document_bytes(bytes: &[u8]) -> String {
    if let Some(content) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(content).into_owned();
    }
    if let Some(content) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return UTF_16LE.decode_without_bom_handling(content).0.into_owned();
    }
    if let Some(content) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return UTF_16BE.decode_without_bom_handling(content).0.into_owned();
    }
    if let Ok(content) = std::str::from_utf8(bytes) {
        return content.to_string();
    }

    if looks_like_utf16le(bytes) {
        return UTF_16LE.decode_without_bom_handling(bytes).0.into_owned();
    }
    if looks_like_utf16be(bytes) {
        return UTF_16BE.decode_without_bom_handling(bytes).0.into_owned();
    }

    let encoding = declared_encoding(bytes).unwrap_or(UTF_8);
    encoding.decode(bytes).0.into_owned()
}

fn looks_like_utf16le(bytes: &[u8]) -> bool {
    let pairs = bytes.chunks_exact(2);
    let pair_count = pairs.len();
    pair_count >= 4 && pairs.filter(|pair| pair[1] == 0).count() * 2 >= pair_count
}

fn looks_like_utf16be(bytes: &[u8]) -> bool {
    let pairs = bytes.chunks_exact(2);
    let pair_count = pairs.len();
    pair_count >= 4 && pairs.filter(|pair| pair[0] == 0).count() * 2 >= pair_count
}

fn declared_encoding(bytes: &[u8]) -> Option<&'static Encoding> {
    let sample = String::from_utf8_lossy(&bytes[..bytes.len().min(8 * 1024)]).to_ascii_lowercase();
    let charset_start = sample.find("charset")? + "charset".len();
    let value = sample[charset_start..]
        .trim_start_matches(|character: char| character.is_ascii_whitespace() || character == '=')
        .trim_start_matches(['\'', '"']);
    let label = value
        .chars()
        .take_while(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .collect::<String>();

    (!label.is_empty())
        .then(|| Encoding::for_label(label.as_bytes()))
        .flatten()
}

fn extract_markdown_title(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim_start();
        let level = trimmed.chars().take_while(|char| *char == '#').count();
        if !(1..=6).contains(&level) {
            return None;
        }

        let title = trimmed[level..].trim();
        if title.is_empty() || !trimmed[level..].starts_with(' ') {
            None
        } else {
            Some(title.trim_end_matches('#').trim().to_string())
        }
    })
}

fn extract_html_title(content: &str) -> Option<String> {
    extract_html_tag_text(content, "title").or_else(|| extract_html_tag_text(content, "h1"))
}

fn extract_html_tag_text(content: &str, tag: &str) -> Option<String> {
    let lower = content.to_lowercase();
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let open_start = lower.find(&open)?;
    let open_end = lower[open_start..].find('>')? + open_start + 1;
    let close_start = lower[open_end..].find(&close)? + open_end;
    let text = content[open_end..close_start].trim();
    if text.is_empty() {
        None
    } else {
        Some(decode_basic_html_entities(text))
    }
}

fn decode_basic_html_entities(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

#[command]
pub fn write_file_checked(
    workspace_path: String,
    path: String,
    content: String,
    expected_content: String,
) -> Result<(), String> {
    use std::io::{Seek, SeekFrom, Write};
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.lock().map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if decode_document_bytes(&bytes) != expected_content {
        return Err(
            "文件已被外部程序修改，未覆盖磁盘。请保留当前草稿并重新打开文件核对差异。".into(),
        );
    }
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    file.set_len(content.len() as u64)
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())
}
