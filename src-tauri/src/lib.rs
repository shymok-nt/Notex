#[cfg(windows)]
use rusqlite::{
    Connection, params_from_iter,
    types::{Value as SqlValue, ValueRef},
};
#[cfg(windows)]
use serde::Serialize;
#[cfg(windows)]
use serde_json::{Map, Number, Value};
#[cfg(windows)]
use std::{fs, path::PathBuf, sync::Mutex, time::Duration};
#[cfg(windows)]
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
#[derive(Default)]
struct NativeSqliteState(Mutex<NativeSqliteInner>);

#[cfg(windows)]
#[derive(Default)]
struct NativeSqliteInner {
    connection: Option<Connection>,
    transaction_id: Option<String>,
}

#[cfg(windows)]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeRunResult {
    last_insert_row_id: i64,
    changes: usize,
}

#[cfg(windows)]
fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Notex uygulama veri dizini alınamadı: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Notex uygulama veri dizini oluşturulamadı: {error}"))?;
    Ok(directory.join("notex.db"))
}

#[cfg(windows)]
fn app_data_path(app: &AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Notex uygulama veri dizini alınamadı: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Notex uygulama veri dizini oluşturulamadı: {error}"))?;
    for child in ["covers", "images", "page-assets", "thumbnails"] {
        fs::create_dir_all(directory.join(child))
            .map_err(|error| format!("Notex dosya alanı oluşturulamadı ({child}): {error}"))?;
    }
    Ok(directory.to_string_lossy().into_owned())
}

#[cfg(windows)]
fn ensure_connection(app: &AppHandle, state: &NativeSqliteState) -> Result<(), String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    if inner.connection.is_some() {
        return Ok(());
    }
    let path = database_path(app)?;
    let connection = Connection::open(&path)
        .map_err(|error| format!("Notex SQLite açılamadı ({}): {error}", path.display()))?;
    connection
        .busy_timeout(Duration::from_secs(10))
        .map_err(|error| format!("Notex SQLite bekleme süresi ayarlanamadı: {error}"))?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|error| format!("Notex SQLite hazırlanamadı: {error}"))?;
    inner.connection = Some(connection);
    Ok(())
}

#[cfg(windows)]
fn with_connection<T>(
    state: &NativeSqliteState,
    transaction_id: Option<&str>,
    operation: impl FnOnce(&Connection) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let inner = state
        .0
        .lock()
        .map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    match inner.transaction_id.as_deref() {
        Some(active) if Some(active) != transaction_id => {
            return Err("Notex SQLite başka bir transaction çalıştırıyor".to_string());
        }
        None if transaction_id.is_some() => {
            return Err("Notex SQLite transaction artık etkin değil".to_string());
        }
        _ => {}
    }
    let connection = inner
        .connection
        .as_ref()
        .ok_or_else(|| "Notex SQLite başlatılmadı".to_string())?;
    operation(connection).map_err(|error| format!("Notex SQLite işlemi başarısız: {error}"))
}

#[cfg(windows)]
fn bind_values(values: Vec<Value>) -> Result<Vec<SqlValue>, String> {
    values.into_iter().map(|value| match value {
    Value::Null => Ok(SqlValue::Null),
    Value::Bool(value) => Ok(SqlValue::Integer(i64::from(value))),
    Value::Number(value) => {
      if let Some(integer) = value.as_i64() { Ok(SqlValue::Integer(integer)) }
      else if let Some(integer) = value.as_u64() { i64::try_from(integer).map(SqlValue::Integer).map_err(|_| "SQLite parametresi 64 bit aralığını aşıyor".to_string()) }
      else { value.as_f64().map(SqlValue::Real).ok_or_else(|| "Geçersiz SQLite sayısal parametresi".to_string()) }
    }
    Value::String(value) => Ok(SqlValue::Text(value)),
    _ => Err("Bu SQLite adaptörü yalnızca metin, sayı, boolean ve null parametrelerini destekliyor".to_string()),
  }).collect()
}

#[cfg(windows)]
fn value_to_json(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(value) => Value::Number(value.into()),
        ValueRef::Real(value) => Number::from_f64(value)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        ValueRef::Text(value) => Value::String(String::from_utf8_lossy(value).into_owned()),
        ValueRef::Blob(value) => Value::Array(
            value
                .iter()
                .map(|byte| Value::Number((*byte).into()))
                .collect(),
        ),
    }
}

#[cfg(windows)]
fn query_rows(
    connection: &Connection,
    query: &str,
    values: Vec<SqlValue>,
) -> rusqlite::Result<Vec<Value>> {
    let mut statement = connection.prepare(query)?;
    let names: Vec<String> = statement.column_names().map(str::to_string).collect();
    let mut rows = statement.query(params_from_iter(values.iter()))?;
    let mut result = Vec::new();
    while let Some(row) = rows.next()? {
        let mut object = Map::new();
        for (index, name) in names.iter().enumerate() {
            object.insert(name.clone(), value_to_json(row.get_ref(index)?));
        }
        result.push(Value::Object(object));
    }
    Ok(result)
}


#[cfg(windows)]
#[tauri::command]
fn notex_cleanup_removed_feature(
    app: AppHandle,
    state: State<'_, NativeSqliteState>,
) -> Result<bool, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    ensure_connection(&app, &state)?;
    let mut inner = state.0.lock().map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    if inner.transaction_id.is_some() {
        return Err("SQLite işlemi devam ederken temizlik yapılamaz".to_string());
    }
    let connection = inner.connection.as_mut().ok_or("Notex SQLite bağlantısı bulunamadı")?;
    let has_feature_table: i64 = connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('courses','topics','pdf_search_index','migration_v3_notebooks_backup','migration_v3_pages_backup')",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("SQLite şeması okunamadı: {e}"))?;
    let mut stmt = connection.prepare("PRAGMA table_info(notebooks)")
        .map_err(|e| format!("Not defteri şeması okunamadı: {e}"))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("Not defteri alanları okunamadı: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Not defteri alanları okunamadı: {e}"))?;
    drop(stmt);
    let has_course = columns.iter().any(|c| c == "course_id");
    let has_topic = columns.iter().any(|c| c == "topic_id");
    if has_feature_table == 0 && !has_course && !has_topic {
        return Ok(false);
    }

    // VACUUM INTO creates a consistent independent SQLite backup even in WAL mode.
    // Never overwrite an earlier backup; leave it available for manual recovery.
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Yedek zaman damgası alınamadı: {e}"))?.as_nanos();
    let backup = database_path(&app)?.with_file_name(format!("notex-before-feature-cleanup-{stamp}.db"));
    let escaped = backup.to_string_lossy().replace('\'', "''");
    connection.execute_batch(&format!("VACUUM INTO '{escaped}'"))
        .map_err(|e| format!("Temizlik öncesi SQLite yedeği oluşturulamadı; hiçbir veri silinmedi: {e}"))?;

    // Every schema change is atomic. If any step fails, SQLite rolls back.
    let tx = connection.transaction()
        .map_err(|e| format!("SQLite temizlik işlemi başlatılamadı: {e}"))?;
    let result = (|| -> rusqlite::Result<()> {
        tx.execute_batch(
            "DROP TABLE IF EXISTS pdf_search_index;
             DROP INDEX IF EXISTS idx_notebooks_course_topic;
             DROP INDEX IF EXISTS idx_topics_course_order;
             DROP TABLE IF EXISTS topics;
             DROP TABLE IF EXISTS courses;
             DROP TABLE IF EXISTS migration_v3_notebooks_backup;
             DROP TABLE IF EXISTS migration_v3_pages_backup;",
        )?;
        if has_topic { tx.execute_batch("ALTER TABLE notebooks DROP COLUMN topic_id;")?; }
        if has_course { tx.execute_batch("ALTER TABLE notebooks DROP COLUMN course_id;")?; }
        tx.execute("DELETE FROM settings WHERE key='schemaVersion' AND value='3'", [])?;
        Ok(())
    })();
    if let Err(error) = result {
        return Err(format!("SQLite temizlik işlemi geri alındı; notlar korunuyor. Yedek: {}. Hata: {error}", backup.display()));
    }
    tx.commit().map_err(|e| format!("SQLite temizliği kaydedilemedi: {e}"))?;
    Ok(true)
}

#[cfg(windows)]
#[tauri::command]
fn notex_db_open(app: AppHandle, state: State<'_, NativeSqliteState>) -> Result<String, String> {
    ensure_connection(&app, &state)?;
    app_data_path(&app)
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_exec(
    state: State<'_, NativeSqliteState>,
    query: String,
    transaction_id: Option<String>,
) -> Result<(), String> {
    with_connection(&state, transaction_id.as_deref(), |connection| {
        connection.execute_batch(&query)
    })
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_run(
    state: State<'_, NativeSqliteState>,
    query: String,
    params: Vec<Value>,
    transaction_id: Option<String>,
) -> Result<NativeRunResult, String> {
    let params = bind_values(params)?;
    with_connection(&state, transaction_id.as_deref(), |connection| {
        let changes = connection.execute(&query, params_from_iter(params.iter()))?;
        Ok(NativeRunResult {
            last_insert_row_id: connection.last_insert_rowid(),
            changes,
        })
    })
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_all(
    state: State<'_, NativeSqliteState>,
    query: String,
    params: Vec<Value>,
    transaction_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let params = bind_values(params)?;
    with_connection(&state, transaction_id.as_deref(), |connection| {
        query_rows(connection, &query, params)
    })
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_begin(
    state: State<'_, NativeSqliteState>,
    transaction_id: String,
) -> Result<(), String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    if inner.transaction_id.is_some() {
        return Err("Notex SQLite transaction zaten etkin".to_string());
    }
    let connection = inner
        .connection
        .as_ref()
        .ok_or_else(|| "Notex SQLite başlatılmadı".to_string())?;
    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("Notex SQLite transaction başlatılamadı: {error}"))?;
    inner.transaction_id = Some(transaction_id);
    Ok(())
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_commit(
    state: State<'_, NativeSqliteState>,
    transaction_id: String,
) -> Result<(), String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    if inner.transaction_id.as_deref() != Some(transaction_id.as_str()) {
        return Err("Notex SQLite transaction kimliği uyuşmuyor".to_string());
    }
    let connection = inner
        .connection
        .as_ref()
        .ok_or_else(|| "Notex SQLite başlatılmadı".to_string())?;
    match connection.execute_batch("COMMIT") {
        Ok(()) => {
            inner.transaction_id = None;
            Ok(())
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            inner.transaction_id = None;
            Err(format!(
                "Notex SQLite transaction commit edilemedi: {error}"
            ))
        }
    }
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
fn notex_db_rollback(
    state: State<'_, NativeSqliteState>,
    transaction_id: String,
) -> Result<(), String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "Notex SQLite kilidi kullanılamıyor".to_string())?;
    if inner.transaction_id.as_deref() != Some(transaction_id.as_str()) {
        return Err("Notex SQLite transaction kimliği uyuşmuyor".to_string());
    }
    let connection = inner
        .connection
        .as_ref()
        .ok_or_else(|| "Notex SQLite başlatılmadı".to_string())?;
    let result = connection
        .execute_batch("ROLLBACK")
        .map_err(|error| format!("Notex SQLite transaction geri alınamadı: {error}"));
    inner.transaction_id = None;
    result
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn persisted_rows_and_transaction_rollback_are_consistent() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "notex-native-sqlite-{}-{nonce}.db",
            std::process::id()
        ));
        let connection = Connection::open(&path).unwrap();
        connection.execute_batch("CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 2;").unwrap();
        let state = NativeSqliteState(Mutex::new(NativeSqliteInner {
            connection: Some(connection),
            transaction_id: None,
        }));

        let token = "commit-check";
        with_connection(&state, None, |connection| {
            connection.execute_batch("BEGIN IMMEDIATE")
        })
        .unwrap();
        state.0.lock().unwrap().transaction_id = Some(token.to_string());
        let params = bind_values(vec![json!("kept")]).unwrap();
        with_connection(&state, Some(token), |connection| {
            connection.execute(
                "INSERT INTO records(value) VALUES(?)",
                params_from_iter(params.iter()),
            )
        })
        .unwrap();
        assert!(
            with_connection(&state, None, |connection| connection.query_row(
                "SELECT COUNT(*) FROM records",
                [],
                |row| row.get::<_, i64>(0)
            ))
            .is_err()
        );
        with_connection(&state, Some(token), |connection| {
            connection.execute_batch("COMMIT")
        })
        .unwrap();
        state.0.lock().unwrap().transaction_id = None;

        let token = "rollback-check";
        with_connection(&state, None, |connection| {
            connection.execute_batch("BEGIN IMMEDIATE")
        })
        .unwrap();
        state.0.lock().unwrap().transaction_id = Some(token.to_string());
        with_connection(&state, Some(token), |connection| {
            connection.execute("INSERT INTO records(value) VALUES('discarded')", [])
        })
        .unwrap();
        with_connection(&state, Some(token), |connection| {
            connection.execute_batch("ROLLBACK")
        })
        .unwrap();
        state.0.lock().unwrap().transaction_id = None;

        drop(state);
        let reopened = Connection::open(&path).unwrap();
        assert_eq!(
            reopened
                .query_row("SELECT value FROM records", [], |row| row
                    .get::<_, String>(0))
                .unwrap(),
            "kept"
        );
        assert_eq!(
            reopened
                .query_row("SELECT COUNT(*) FROM records", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            reopened
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            2
        );
        drop(reopened);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
    #[cfg(windows)]
    let builder =
        builder
            .manage(NativeSqliteState::default())
            .invoke_handler(tauri::generate_handler![
                notex_db_open,
                notex_cleanup_removed_feature,
                notex_db_exec,
                notex_db_run,
                notex_db_all,
                notex_db_begin,
                notex_db_commit,
                notex_db_rollback
            ]);
    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
