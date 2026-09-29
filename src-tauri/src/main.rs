// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_config;
mod browser_preview;
mod comments;
mod export;
mod fs_handler;
mod html_preview_protocol;
mod mcp;
mod path_guard;
mod search;
mod translation;

#[tauri::command]
fn e2e_workspace_path() -> Result<String, String> {
    #[cfg(feature = "e2e")]
    {
        let path = std::env::var_os("E2E_WORKSPACE_PATH")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::env::temp_dir().join("markdown-html-e2e-workspace 中文 &^#"));
        return Ok(path.to_string_lossy().into_owned());
    }

    #[cfg(not(feature = "e2e"))]
    Err("E2E workspace discovery is unavailable in production builds".to_string())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--mcp") {
        if let Err(error) = mcp::run(&args) {
            eprintln!("{}", error);
            std::process::exit(1);
        }
        return;
    }
    let builder = tauri::Builder::default()
        .manage(html_preview_protocol::PreviewProtocolRoots::default())
        .register_uri_scheme_protocol("preview", |context, request| {
            html_preview_protocol::handle(context.app_handle(), request)
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());

    builder
        .invoke_handler(tauri::generate_handler![
            app_config::load_openai_api_key,
            app_config::save_openai_api_key,
            mcp::mcp_configuration,
            fs_handler::list_files,
            fs_handler::read_file,
            fs_handler::write_file,
            fs_handler::write_file_checked,
            fs_handler::create_markdown_file,
            fs_handler::delete_markdown_file,
            comments::calculate_file_hash,
            comments::load_comments,
            comments::save_comment,
            comments::delete_comment,
            comments::update_comment,
            search::search_files,
            search::search_content,
            export::export_rendered_html,
            export::read_export_resource,
            translation::translate_text,
            translation::test_openai_compatible_connection,
            translation::fetch_openai_compatible_models,
            translation::translate_markdown_to_chinese,
            translation::generate_ai_reading_html,
            translation::suggest_document_improvements,
            translation::optimize_document_with_comments,
            browser_preview::open_html_in_default_browser,
            e2e_workspace_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod e2e_tests {
    use super::{comments, fs_handler, search};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-e2e-test-{}-{}",
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn core_file_comment_search_export_path_works() {
        let root = unique_test_root();
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("note.md");
        fs::write(&file_path, "# Note\n\nOriginal keyword").unwrap();

        let root = root.to_string_lossy().to_string();
        let file_path = file_path.to_string_lossy().to_string();

        let files = fs_handler::list_workspace_files(root.clone()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "note.md");

        let content = fs_handler::read_file(root.clone(), file_path.clone()).unwrap();
        assert!(content.contains("Original keyword"));

        let first_hash = comments::calculate_file_hash(root.clone(), file_path.clone()).unwrap();
        comments::save_comment(
            root.clone(),
            first_hash.clone(),
            file_path.clone(),
            comments::Comment {
                id: "comment-1".to_string(),
                file_hash: first_hash.clone(),
                anchor: comments::CommentAnchor {
                    quote: "Original keyword".to_string(),
                    offset: 8,
                    length: 16,
                },
                content: "Review note".to_string(),
                status: "open".to_string(),
                created_at: 10,
                updated_at: 10,
            },
        )
        .unwrap();

        fs_handler::write_file(
            root.clone(),
            file_path.clone(),
            "# Note\n\nEdited keyword".to_string(),
        )
        .unwrap();
        let second_hash = comments::calculate_file_hash(root.clone(), file_path.clone()).unwrap();
        assert_ne!(first_hash, second_hash);

        let loaded_comments =
            comments::load_comments(root.clone(), second_hash.clone(), file_path.clone()).unwrap();
        assert_eq!(loaded_comments.len(), 1);
        assert_eq!(loaded_comments[0].id, "comment-1");

        let file_results = search::search_files(root.clone(), "note".to_string()).unwrap();
        assert_eq!(file_results.len(), 1);
        assert_eq!(file_results[0].name, "note.md");

        let content_results =
            search::search_content(root.clone(), "keyword".to_string(), Some(10)).unwrap();
        assert_eq!(content_results.len(), 1);
        assert_eq!(content_results[0].file_name, "note.md");
        assert!(content_results[0].line_content.contains("Edited keyword"));

        let output_path = PathBuf::from(&root).join("note.html");
        let output_path = output_path.to_string_lossy().to_string();
        search::export_as_html(root.clone(), file_path, output_path.clone(), None, false).unwrap();
        let exported = fs::read_to_string(output_path).unwrap();
        assert!(exported.contains("Edited keyword"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn windows_style_special_paths_and_crlf_survive_core_operations() {
        let root = unique_test_root().join("Windows path &^# 中文 with spaces");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("笔记 &^#.md");
        let original = "# Windows\r\n\r\nCRLF 内容 & ^ #\r\n";
        fs::write(&file_path, original).unwrap();

        assert!(root.is_absolute());
        #[cfg(windows)]
        {
            use std::path::Component;
            assert!(matches!(
                root.components().next(),
                Some(Component::Prefix(_))
            ));
            assert!(root.to_string_lossy().contains('\\'));
        }

        let workspace = root.to_string_lossy().into_owned();
        let path = file_path.to_string_lossy().into_owned();
        assert_eq!(
            fs_handler::read_file(workspace.clone(), path.clone()).unwrap(),
            original
        );

        let hash = comments::calculate_file_hash(workspace.clone(), path.clone()).unwrap();
        comments::save_comment(
            workspace.clone(),
            hash.clone(),
            path.clone(),
            comments::Comment {
                id: "windows-comment".into(),
                file_hash: hash.clone(),
                anchor: comments::CommentAnchor {
                    quote: "CRLF 内容 & ^ #".into(),
                    offset: 13,
                    length: 15,
                },
                content: "Windows 路径评论".into(),
                status: "open".into(),
                created_at: 10,
                updated_at: 10,
            },
        )
        .unwrap();
        assert_eq!(
            comments::load_comments(workspace.clone(), hash, path.clone())
                .unwrap()
                .len(),
            1
        );

        let output = root.join("导出 &^#.html").to_string_lossy().into_owned();
        search::export_as_html(workspace.clone(), path, output.clone(), None, false).unwrap();
        assert!(fs::read_to_string(output)
            .unwrap()
            .contains("CRLF 内容 &amp; ^ #"));

        fs::remove_dir_all(root).unwrap();
    }
}
