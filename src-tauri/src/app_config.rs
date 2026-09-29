use std::fs;
use std::path::Path;
use tauri::Manager;

const OPENAI_API_KEY_ENV: &str = "OPENAI_COMPATIBLE_API_KEY";

#[tauri::command]
pub fn load_openai_api_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    read_openai_api_key(&app_config_env_path(&app)?)
}

#[tauri::command]
pub fn save_openai_api_key(app: tauri::AppHandle, api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 不能为空".to_string());
    }
    write_openai_api_key(&app_config_env_path(&app)?, api_key)
}

fn app_config_env_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(".env"))
        .map_err(|error| format!("无法定位应用配置目录：{error}"))
}

fn read_openai_api_key(path: &Path) -> Result<Option<String>, String> {
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("无法读取 API Key 配置：{error}")),
    };

    Ok(contents.lines().find_map(|line| {
        let (name, value) = line.trim().split_once('=')?;
        (name.trim() == OPENAI_API_KEY_ENV).then(|| parse_env_value(value)).flatten()
    }))
}

fn write_openai_api_key(path: &Path, api_key: &str) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or_else(|| "无法定位应用配置目录".to_string())?;
    fs::create_dir_all(directory).map_err(|error| format!("无法创建应用配置目录：{error}"))?;

    let existing = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("无法读取 API Key 配置：{error}")),
    };
    let value = serde_json::to_string(api_key).map_err(|error| format!("无法编码 API Key：{error}"))?;
    fs::write(path, replace_env_value(&existing, OPENAI_API_KEY_ENV, &value))
        .map_err(|error| format!("无法保存 API Key 配置：{error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("无法保护 API Key 配置：{error}"))?;
    }
    Ok(())
}

fn parse_env_value(value: &str) -> Option<String> {
    let value = value.trim();
    let value = serde_json::from_str::<String>(value).unwrap_or_else(|_| value.to_string());
    (!value.trim().is_empty()).then_some(value)
}

fn replace_env_value(contents: &str, name: &str, value: &str) -> String {
    let assignment = format!("{name}={value}");
    let mut replaced = false;
    let mut lines = Vec::new();

    for line in contents.lines() {
        let is_target = line
            .trim()
            .split_once('=')
            .is_some_and(|(existing_name, _)| existing_name.trim() == name);
        if !is_target {
            lines.push(line);
        } else if !replaced {
            lines.push(&assignment);
            replaced = true;
        }
    }
    if !replaced {
        lines.push(&assignment);
    }
    format!("{}\n", lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::{read_openai_api_key, write_openai_api_key, OPENAI_API_KEY_ENV};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_env_path() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!("md-html-reader-settings-{}-{suffix}", std::process::id()))
            .join(".env")
    }

    #[test]
    fn saves_and_loads_api_key_without_removing_other_env_values() {
        let path = test_env_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path.parent().unwrap().join(".env"), "OTHER_SETTING=kept\n").unwrap();

        write_openai_api_key(&path, "sk-test-key").unwrap();

        assert_eq!(read_openai_api_key(&path).unwrap().as_deref(), Some("sk-test-key"));
        let contents = fs::read_to_string(&path).unwrap();
        assert!(contents.contains("OTHER_SETTING=kept"));
        assert!(contents.contains(&format!("{OPENAI_API_KEY_ENV}=\"sk-test-key\"")));

        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn returns_none_when_the_env_file_is_missing() {
        let path = test_env_path();
        assert_eq!(read_openai_api_key(&path).unwrap(), None);
    }
}
