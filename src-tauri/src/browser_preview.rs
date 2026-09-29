use std::path::PathBuf;
use tauri::command;
use tauri_plugin_shell::ShellExt;

use crate::path_guard::{document_file_in_workspace, is_html_document_path};

#[command]
pub fn open_html_in_default_browser(
    app: tauri::AppHandle,
    workspace_path: String,
    file_path: String,
) -> Result<(), String> {
    let file_path = validate_html_preview_path(&workspace_path, &file_path)?;
    #[allow(deprecated)]
    app.shell()
        .open(file_path.to_string_lossy().into_owned(), None)
        .map_err(|error| format!("打开默认浏览器失败: {error}"))
}

fn validate_html_preview_path(workspace_path: &str, file_path: &str) -> Result<PathBuf, String> {
    let file_path = document_file_in_workspace(workspace_path, file_path)?;
    if !is_html_document_path(&file_path) {
        return Err("只能预览 HTML 文件".to_string());
    }

    Ok(file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-preview-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn validate_html_preview_path_requires_workspace_html_file() {
        let workspace = unique_test_root("workspace with spaces &^# 中文");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let html = workspace.join("页面 &^#.html");
        let markdown = workspace.join("note.md");
        let outside_html = outside.join("outside.html");
        fs::write(&html, "<h1>Page</h1>").unwrap();
        fs::write(&markdown, "# Note").unwrap();
        fs::write(&outside_html, "<h1>Outside</h1>").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        assert!(validate_html_preview_path(&workspace, html.to_string_lossy().as_ref()).is_ok());
        assert!(
            validate_html_preview_path(&workspace, markdown.to_string_lossy().as_ref()).is_err()
        );
        assert!(
            validate_html_preview_path(&workspace, outside_html.to_string_lossy().as_ref())
                .is_err()
        );

        fs::remove_dir_all(PathBuf::from(&workspace)).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}
