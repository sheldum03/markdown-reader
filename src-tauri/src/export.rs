use base64::Engine;
use std::fs;
#[tauri::command]
pub fn export_rendered_html(
    workspace_path: String,
    output_path: String,
    html: String,
) -> Result<(), String> {
    let output = crate::path_guard::output_file_in_workspace(&workspace_path, &output_path)?;
    if output.exists() {
        return Err("An HTML export already exists; the existing file was not overwritten".into());
    }
    fs::write(output, html).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn read_export_resource(workspace_path: String, path: String) -> Result<String, String> {
    let root = crate::path_guard::workspace_root(&workspace_path)?;
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    crate::path_guard::ensure_within_workspace(&root, &path)?;
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => return Err("Only image resources can be embedded".into()),
    };
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("Image exceeds 20 MiB".into());
    }
    Ok(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD
            .encode(fs::read(path).map_err(|e| e.to_string())?)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_and_output_boundaries() {
        let root = std::env::temp_dir().join(format!("reader-export-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("pixel.png"), b"fixture").unwrap();
        let workspace = root.to_string_lossy().into_owned();
        assert!(read_export_resource(
            workspace.clone(),
            root.join("pixel.png").to_string_lossy().into_owned()
        )
        .unwrap()
        .starts_with("data:image/png;base64,"));
        assert!(read_export_resource(workspace.clone(), "/etc/passwd".into()).is_err());
        let output = root.join("page.html").to_string_lossy().into_owned();
        export_rendered_html(workspace.clone(), output.clone(), "<p>first</p>".into()).unwrap();
        assert!(export_rendered_html(
            workspace.clone(),
            output.clone(),
            "<p>replacement</p>".into()
        )
        .is_err());
        assert_eq!(fs::read_to_string(output).unwrap(), "<p>first</p>");
        assert!(export_rendered_html(
            workspace.clone(),
            root.join("../outside.html").to_string_lossy().into_owned(),
            "denied".into()
        )
        .is_err());
        let note = root.join("note.md").to_string_lossy().into_owned();
        fs::write(&note, "external update").unwrap();
        assert!(crate::fs_handler::write_file_checked(
            workspace,
            note.clone(),
            "stale draft".into(),
            "original".into()
        )
        .is_err());
        assert_eq!(fs::read_to_string(note).unwrap(), "external update");
        fs::remove_dir_all(root).unwrap();
    }
}
