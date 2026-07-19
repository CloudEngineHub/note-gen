use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Manager};
use zip::ZipArchive;

const MAX_ZIP_BYTES: u64 = 50 * 1024 * 1024;
const MAX_ENTRY_BYTES: u64 = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES: u64 = 200 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 1_000;
const MAX_PATH_DEPTH: usize = 20;

#[command]
pub async fn import_skill_zip(app_handle: AppHandle, zip_path: String) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to get app data directory: {error}"))?;
    let skills_dir = app_data_dir.join("skills");
    fs::create_dir_all(&skills_dir)
        .map_err(|error| format!("Failed to create skills directory: {error}"))?;

    let archive_metadata =
        fs::metadata(&zip_path).map_err(|error| format!("Failed to inspect zip file: {error}"))?;
    if archive_metadata.len() > MAX_ZIP_BYTES {
        return Err(format!(
            "Skill archive exceeds the {} MB limit",
            MAX_ZIP_BYTES / 1024 / 1024
        ));
    }

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();
    let temp_dir = app_data_dir.join(format!(
        "temp_skill_import_{}_{}",
        std::process::id(),
        nonce
    ));
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("Failed to create temporary import directory: {error}"))?;

    let import_result = import_skill_zip_inner(&zip_path, &temp_dir, &skills_dir, nonce);
    if let Err(error) = fs::remove_dir_all(&temp_dir) {
        eprintln!("Failed to clean Skill import temporary directory: {error}");
    }
    import_result
}

fn import_skill_zip_inner(
    zip_path: &str,
    temp_dir: &Path,
    skills_dir: &Path,
    nonce: u128,
) -> Result<String, String> {
    let file =
        fs::File::open(zip_path).map_err(|error| format!("Failed to open zip file: {error}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Failed to read zip archive: {error}"))?;

    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(format!(
            "Skill archive contains more than {MAX_ARCHIVE_ENTRIES} entries"
        ));
    }

    let mut total_uncompressed = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to read zip entry: {error}"))?;
        let relative_path = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe path in Skill archive: {}", entry.name()))?
            .to_path_buf();

        if relative_path.components().count() > MAX_PATH_DEPTH {
            return Err(format!(
                "Skill archive path is nested too deeply: {}",
                entry.name()
            ));
        }
        if is_symlink(&entry) {
            return Err(format!(
                "Symbolic links are not allowed in Skill archives: {}",
                entry.name()
            ));
        }
        if entry.size() > MAX_ENTRY_BYTES {
            return Err(format!(
                "Skill archive entry exceeds the size limit: {}",
                entry.name()
            ));
        }

        total_uncompressed = total_uncompressed
            .checked_add(entry.size())
            .ok_or("Skill archive size overflow")?;
        if total_uncompressed > MAX_UNCOMPRESSED_BYTES {
            return Err(format!(
                "Uncompressed Skill archive exceeds the {} MB limit",
                MAX_UNCOMPRESSED_BYTES / 1024 / 1024
            ));
        }

        let output_path = temp_dir.join(relative_path);
        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|error| format!("Failed to create archive directory: {error}"))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create archive parent directory: {error}"))?;
        }
        let mut output = fs::File::create(&output_path)
            .map_err(|error| format!("Failed to create extracted file: {error}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Failed to extract archive file: {error}"))?;
    }

    let mut roots = Vec::new();
    collect_skill_roots(temp_dir, 0, &mut roots)?;
    if roots.is_empty() {
        return Err(
            "No valid Skill found. A Skill archive must contain exactly one SKILL.md root."
                .to_string(),
        );
    }
    if roots.len() != 1 {
        return Err(
            "Skill archive contains multiple SKILL.md roots; import each Skill separately."
                .to_string(),
        );
    }
    let skill_root = roots.remove(0);
    let skill_name = if skill_root == temp_dir {
        Path::new(zip_path)
            .file_stem()
            .and_then(|name| name.to_str())
            .ok_or("Failed to determine Skill directory name")?
            .to_string()
    } else {
        skill_root
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("Failed to determine Skill directory name")?
            .to_string()
    };
    if !is_safe_skill_name(&skill_name) {
        return Err(
            "Skill directory name must contain 1-64 lowercase letters, digits, or hyphens"
                .to_string(),
        );
    }

    let destination = skills_dir.join(&skill_name);
    let staged = skills_dir.join(format!(".import-{skill_name}-{nonce}"));
    let backup = skills_dir.join(format!(".backup-{skill_name}-{nonce}"));
    if let Err(error) = copy_dir_recursive(&skill_root, &staged) {
        let _ = fs::remove_dir_all(&staged);
        return Err(format!("Failed to stage Skill import: {error}"));
    }

    let had_existing = destination.exists();
    if had_existing {
        fs::rename(&destination, &backup)
            .map_err(|error| format!("Failed to back up existing Skill: {error}"))?;
    }

    if let Err(error) = fs::rename(&staged, &destination) {
        let _ = fs::remove_dir_all(&staged);
        if had_existing {
            let _ = fs::rename(&backup, &destination);
        }
        return Err(format!("Failed to activate imported Skill: {error}"));
    }
    if had_existing {
        if let Err(error) = fs::remove_dir_all(&backup) {
            eprintln!("Failed to clean previous Skill version after import: {error}");
        }
    }

    Ok(skill_name)
}

fn is_symlink<R: std::io::Read>(entry: &zip::read::ZipFile<'_, R>) -> bool {
    entry
        .unix_mode()
        .map(|mode| mode & 0o170000 == 0o120000)
        .unwrap_or(false)
}

fn is_safe_skill_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 64
        && bytes.first() != Some(&b'-')
        && bytes.last() != Some(&b'-')
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-')
}

fn collect_skill_roots(root: &Path, depth: usize, roots: &mut Vec<PathBuf>) -> Result<(), String> {
    if depth > MAX_PATH_DEPTH {
        return Err("Skill archive directory nesting exceeds the allowed depth".to_string());
    }
    if root.join("SKILL.md").is_file() {
        roots.push(root.to_path_buf());
    }

    for entry in
        fs::read_dir(root).map_err(|error| format!("Failed to read archive directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read archive entry: {error}"))?;
        let path = entry.path();
        if path.is_dir() && !is_ignored_zip_metadata_dir(&path) {
            collect_skill_roots(&path, depth + 1, roots)?;
        }
    }
    Ok(())
}

fn is_ignored_zip_metadata_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name == "__MACOSX")
        .unwrap_or(false)
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("Failed to create directory: {error}"))?;
    for entry in
        fs::read_dir(source).map_err(|error| format!("Failed to read source directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect imported file: {error}"))?;
        if file_type.is_symlink() {
            return Err(format!(
                "Symbolic links are not allowed: {}",
                source_path.display()
            ));
        }
        if file_type.is_file() {
            fs::copy(&source_path, &destination_path)
                .map_err(|error| format!("Failed to copy file: {error}"))?;
        } else if file_type.is_dir() {
            copy_dir_recursive(&source_path, &destination_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn test_directory(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("notegen-{label}-{}", uuid::Uuid::new_v4()))
    }

    fn write_test_archive(path: &Path, entries: &[(&str, &str)]) {
        let file = fs::File::create(path).unwrap();
        let mut writer = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, content) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(content.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn validates_skill_directory_names() {
        assert!(is_safe_skill_name("secure-skill"));
        assert!(!is_safe_skill_name("Secure-Skill"));
        assert!(!is_safe_skill_name("../secure-skill"));
        assert!(!is_safe_skill_name("-secure"));
    }

    #[test]
    fn detects_multiple_skill_roots() {
        let root = test_directory("multiple-roots");
        fs::create_dir_all(root.join("one")).unwrap();
        fs::create_dir_all(root.join("two")).unwrap();
        fs::write(root.join("one/SKILL.md"), "---\nname: one\n---").unwrap();
        fs::write(root.join("two/SKILL.md"), "---\nname: two\n---").unwrap();
        let mut roots = Vec::new();
        collect_skill_roots(&root, 0, &mut roots).unwrap();
        assert_eq!(roots.len(), 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn detects_zip_symbolic_links() {
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .add_symlink("unsafe-link", "/tmp/private", SimpleFileOptions::default())
            .unwrap();
        let bytes = writer.finish().unwrap().into_inner();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let entry = archive.by_index(0).unwrap();
        assert!(is_symlink(&entry));
    }

    #[test]
    fn imports_through_staging_and_replaces_existing_skill() {
        let root = test_directory("atomic-import");
        let archive_path = root.join("secure-skill.zip");
        let extract_dir = root.join("extract");
        let skills_dir = root.join("skills");
        fs::create_dir_all(&extract_dir).unwrap();
        fs::create_dir_all(skills_dir.join("secure-skill")).unwrap();
        fs::write(skills_dir.join("secure-skill/old.txt"), "old").unwrap();
        write_test_archive(
            &archive_path,
            &[
                (
                    "secure-skill/SKILL.md",
                    "---\nname: secure-skill\ndescription: test\n---\n",
                ),
                ("secure-skill/scripts/ok.py", "print('ok')\n"),
            ],
        );

        let imported =
            import_skill_zip_inner(archive_path.to_str().unwrap(), &extract_dir, &skills_dir, 1)
                .unwrap();
        assert_eq!(imported, "secure-skill");
        assert!(skills_dir.join("secure-skill/scripts/ok.py").is_file());
        assert!(!skills_dir.join("secure-skill/old.txt").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
