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

#[cfg(windows)]
struct OcrWorker {
    child: std::process::Child,
    input: std::process::ChildStdin,
    output: std::io::BufReader<std::process::ChildStdout>,
}

#[cfg(windows)]
static OCR_WORKER: std::sync::OnceLock<Mutex<Option<OcrWorker>>> = std::sync::OnceLock::new();

#[cfg(windows)]
fn start_ocr_worker() -> Result<OcrWorker, String> {
    use std::io::BufRead;
    use std::process::{Command, Stdio};
    let mut root = std::env::current_dir().map_err(|error| error.to_string())?;
    let mut found = None;
    for _ in 0..5 {
        let python = root.join(".venv-ocr").join("Scripts").join("python.exe");
        let script = root.join("tools").join("handwriting_ocr").join("recognize.py");
        if python.is_file() && script.is_file() {
            found = Some((python, script));
            break;
        }
        if !root.pop() { break; }
    }
    let (python, script) = found.ok_or_else(|| "OCR kurulumu bulunamadı (.venv-ocr)".to_string())?;
    let mut child = Command::new(python)
        .arg("-u").arg(script).arg("--serve")
        .env("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit())
        .spawn().map_err(|error| format!("OCR worker başlatılamadı: {error}"))?;
    let input = child.stdin.take().ok_or("OCR stdin açılamadı")?;
    let stdout = child.stdout.take().ok_or("OCR stdout açılamadı")?;
    let mut output = std::io::BufReader::new(stdout);
    for _ in 0..100 {
        let mut bytes = Vec::new();
        if output.read_until(b'\n', &mut bytes).map_err(|error| error.to_string())? == 0 {
            return Err("OCR worker başlatılırken kapandı".into());
        }
        // Paddle/Python dependencies can emit non-UTF-8 console diagnostics.
        // Ignore those lines; only JSON protocol messages are authoritative.
        if let Ok(line) = std::str::from_utf8(&bytes) {
            if let Ok(value) = serde_json::from_str::<Value>(line) {
                if value.get("ready").and_then(Value::as_bool) == Some(true) {
                    return Ok(OcrWorker { child, input, output });
                }
                if value.get("ready").and_then(Value::as_bool) == Some(false) {
                    return Err(value.get("error").and_then(Value::as_str).unwrap_or("OCR başlatılamadı").to_string());
                }
            }
        }
    }
    Err("OCR worker hazır yanıtı vermedi".into())
}

#[cfg(windows)]
#[tauri::command]
async fn notex_ocr_preload() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let lock = OCR_WORKER.get_or_init(|| Mutex::new(None));
        let mut guard = lock.lock().map_err(|_| "OCR worker kilidi bozuldu".to_string())?;
        if guard.is_none() { *guard = Some(start_ocr_worker()?); }
        Ok(serde_json::json!({"ready": true}))
    }).await.map_err(|error| format!("OCR hazırlama görevi başarısız: {error}"))?
}

#[cfg(windows)]
#[tauri::command(rename_all = "camelCase")]
async fn notex_recognize_handwriting(png_base64: String, engine: Option<String>) -> Result<Value, String> {
    if png_base64.len() > 8_000_000 { return Err("OCR görseli çok büyük".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, Write};
        let worker_lock = OCR_WORKER.get_or_init(|| Mutex::new(None));
        let mut guard = worker_lock.lock().map_err(|_| "OCR worker kilidi bozuldu".to_string())?;
        if guard.is_none() { *guard = Some(start_ocr_worker()?); }
        let worker = guard.as_mut().ok_or("OCR worker kullanılamıyor")?;
        let _ = engine;
        let engine = "paddle";
        let request = serde_json::json!({"pngBase64": png_base64, "engine": engine});
        let result = (|| -> Result<Value, String> {
            writeln!(worker.input, "{request}").map_err(|error| error.to_string())?;
            worker.input.flush().map_err(|error| error.to_string())?;
            for _ in 0..100 {
                let mut bytes = Vec::new();
                if worker.output.read_until(b'\n', &mut bytes).map_err(|error| error.to_string())? == 0 {
                    return Err("OCR worker yanıt vermeden kapandı".into());
                }
                if let Ok(line) = std::str::from_utf8(&bytes) {
                    if let Ok(value) = serde_json::from_str::<Value>(line) {
                        if value.get("ok").is_some() { return Ok(value); }
                    }
                }
                // Non-JSON or non-UTF-8 diagnostic output must not kill OCR.
                // Keep reading until the actual JSON result arrives.
            }
            Err("OCR worker geçerli yanıt döndürmedi".into())
        })();
        if result.is_err() {
            if let Some(mut broken) = guard.take() { let _ = broken.child.kill(); }
        }
        let value = result?;
        if value.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(value.get("error").and_then(Value::as_str).unwrap_or("OCR başarısız").to_string());
        }
        Ok(value)
    }).await.map_err(|error| format!("OCR görevi tamamlanamadı: {error}"))?
}

#[cfg(windows)]
#[derive(serde::Deserialize)]
struct InkTestPoint { x: f32, y: f32, pressure: f32 }
#[cfg(windows)]
#[derive(serde::Deserialize)]
struct InkTestStroke { id: String, points: Vec<InkTestPoint> }
#[cfg(windows)]
#[derive(serde::Deserialize)]
struct InkTestInput { locale: String, strokes: Vec<InkTestStroke> }

/// Explicit test-only recognition. Does not read/write Notex pages or invoke legacy OCR.
#[cfg(windows)]
#[tauri::command]
async fn notex_windows_ink_recognize_test(input: InkTestInput) -> Result<Value, String> {
    if input.locale != "tr-TR" { return Err("Yalnızca tr-TR test dili destekleniyor".into()); }
    if input.strokes.is_empty() || input.strokes.len() > 256 {
        return Err("Test için 1-256 kalem çizgisi gerekli".into());
    }
    let mut total = 0usize;
    for stroke in &input.strokes {
        total += stroke.points.len();
        if stroke.id.len() > 128 || stroke.points.is_empty() || stroke.points.len() > 4096 ||
           stroke.points.iter().any(|p| !p.x.is_finite() || !p.y.is_finite() ||
               !p.pressure.is_finite() || p.x.abs() > 100_000.0 || p.y.abs() > 100_000.0) {
            return Err("Geçersiz kalem koordinatları".into());
        }
    }
    if total > 30_000 { return Err("Test çizgileri çok büyük".into()); }

    tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        use windows::Foundation::Point;
        use windows::UI::Input::Inking::{
            InkRecognitionTarget, InkRecognizerContainer, InkStrokeBuilder, InkStrokeContainer,
        };
        use windows_collections::IIterable;
        let recognizer = InkRecognizerContainer::new().map_err(|e| e.to_string())?;
        let installed = recognizer.GetRecognizers().map_err(|e| e.to_string())?;
        let mut turkish = None;
        for index in 0..installed.Size().map_err(|e| e.to_string())? {
            let candidate = installed.GetAt(index).map_err(|e| e.to_string())?;
            let name = candidate.Name().map_err(|e| e.to_string())?.to_string().to_lowercase();
            if name.contains("türkiye") || name.contains("turkish") ||
               name.contains("türkçe") || name.contains("turkce") {
                turkish = Some(candidate);
                break;
            }
        }
        let Some(turkish) = turkish else {
            return Ok(serde_json::json!({"status":"unavailable","reason":"Türkçe Windows Ink tanıyıcısı kurulu değil"}));
        };
        recognizer.SetDefaultRecognizer(&turkish).map_err(|e| e.to_string())?;
        let container = InkStrokeContainer::new().map_err(|e| e.to_string())?;
        let builder = InkStrokeBuilder::new().map_err(|e| e.to_string())?;
        for stroke in input.strokes {
            let mut points: Vec<Point> = stroke.points.into_iter().map(|p| Point { X:p.x, Y:p.y }).collect();
            // Windows Ink needs a path, including for detached single-point dots.
            if points.len() == 1 { points.push(Point { X:points[0].X+0.1, Y:points[0].Y+0.1 }); }
            let iterable = IIterable::<Point>::from(points);
            let ink_stroke = builder.CreateStroke(&iterable).map_err(|e| e.to_string())?;
            container.AddStroke(&ink_stroke).map_err(|e| e.to_string())?;
        }
        let operation = recognizer.RecognizeAsync(&container, InkRecognitionTarget::All)
            .map_err(|e| e.to_string())?;
        let results = operation.join().map_err(|e| e.to_string())?;
        let mut words = Vec::new();
        for index in 0..results.Size().map_err(|e| e.to_string())? {
            let result = results.GetAt(index).map_err(|e| e.to_string())?;
            let candidates = result.GetTextCandidates().map_err(|e| e.to_string())?;
            let mut options = Vec::new();
            for n in 0..candidates.Size().map_err(|e| e.to_string())?.min(5) {
                options.push(candidates.GetAt(n).map_err(|e| e.to_string())?.to_string());
            }
            words.push(serde_json::json!({"candidates":options}));
        }
        Ok(serde_json::json!({"status":"recognized","engine":"windows-ink-tr-TR","words":words}))
    }).await.map_err(|e| format!("Windows Ink tanıma görevi tamamlanamadı: {e}"))?
}

/// Read-only capability check. Never invokes recognition or changes stored ink.
#[cfg(windows)]
#[tauri::command]
async fn notex_windows_ink_capability() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        use windows::UI::Input::Inking::InkRecognizerContainer;
        let recognizers = match InkRecognizerContainer::new() {
            Ok(container) => match container.GetRecognizers() {
                Ok(items) => items,
                Err(error) => return Ok(serde_json::json!({
                    "available": false, "locale": "tr-TR",
                    "reason": format!("Windows Ink tanıyıcı listesi okunamadı: {error}")
                })),
            },
            Err(error) => return Ok(serde_json::json!({
                "available": false, "locale": "tr-TR",
                "reason": format!("Windows Ink başlatılamadı: {error}")
            })),
        };
        let count = match recognizers.Size() {
            Ok(count) => count,
            Err(error) => return Ok(serde_json::json!({
                "available": false, "locale": "tr-TR",
                "reason": format!("Windows Ink tanıyıcı sayısı alınamadı: {error}")
            })),
        };
        let mut names = Vec::new();
        let mut turkish = false;
        for index in 0..count {
            if let Ok(recognizer) = recognizers.GetAt(index) {
                if let Ok(name) = recognizer.Name() {
                    let label = name.to_string();
                    let lower = label.to_lowercase();
                    if lower.contains("türkiye") || lower.contains("turkish") ||
                       lower.contains("türkçe") || lower.contains("turkce") {
                        turkish = true;
                    }
                    names.push(label);
                }
            }
        }
        Ok::<Value, String>(serde_json::json!({
            "available": turkish,
            "locale": "tr-TR",
            "recognizers": names,
            "reason": if turkish { Value::Null } else {
                Value::String("Windows üzerinde Türkçe el yazısı tanıyıcısı bulunamadı".into())
            }
        }))
    }).await.map_err(|error| format!("Windows Ink kontrolü tamamlanamadı: {error}"))?
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
                notex_db_exec,
                notex_db_run,
                notex_db_all,
                notex_db_begin,
                notex_db_commit,
                notex_db_rollback,
                notex_recognize_handwriting,
                notex_ocr_preload,
                notex_windows_ink_capability,
                notex_windows_ink_recognize_test
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
