import type { SQLiteDatabase } from 'expo-sqlite';
export type Migration={version:number;run:(db:SQLiteDatabase)=>Promise<void>};
export const migrations:Migration[]=[{
 version:1,
 run:async db=>{
  await db.execAsync(`
   CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    cover_type TEXT NOT NULL CHECK(cover_type IN ('color','image','preset')),
    cover_color TEXT, cover_image_path TEXT, cover_preset_id TEXT,
    show_title_on_cover INTEGER NOT NULL DEFAULT 1,
    template TEXT NOT NULL CHECK(template IN ('boş','çizgili','kareli','noktalı')),
    paper_color TEXT NOT NULL CHECK(paper_color IN ('beyaz','krem')),
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
   );
   CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    template TEXT NOT NULL, paper_color TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '{"v":1,"strokes":[]}',
    thumbnail_path TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_pages_notebook_position ON pages(notebook_id,position);
   CREATE INDEX IF NOT EXISTS idx_notebooks_folder ON notebooks(folder_id);
   CREATE INDEX IF NOT EXISTS idx_notebooks_updated ON notebooks(updated_at);
  `);
  const now=new Date().toISOString();
  for(const [id,name,position] of [['ders','Ders',0],['is','İş',1],['kisisel','Kişisel',2]] as const){
   await db.runAsync('INSERT OR IGNORE INTO folders(id,name,position,created_at) VALUES(?,?,?,?)',id,name,position,now);
  }
 }
}];
export const latestMigrationVersion=3;
migrations.push({
 version:2,
 run:async db=>{
  await db.execAsync(`
   ALTER TABLE notebooks ADD COLUMN auto_convert_enabled INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE notebooks ADD COLUMN conversion_font TEXT NOT NULL DEFAULT 'Inter';
   ALTER TABLE notebooks ADD COLUMN conversion_delay_ms INTEGER NOT NULL DEFAULT 1000;
  `);
 }
});

// All existing notebooks remain unclassified. This migration is atomic:
// if any statement fails, user_version remains 2 and existing data is intact.
// Snapshot tables are created before altering the live schema.
migrations.push({
 version:3,
 run:async db=>{
  await db.execAsync(`
   CREATE TABLE IF NOT EXISTS migration_v3_notebooks_backup AS SELECT * FROM notebooks;
   CREATE TABLE IF NOT EXISTS migration_v3_pages_backup AS SELECT * FROM pages;
   CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
    icon TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL
   );
   ALTER TABLE notebooks ADD COLUMN course_id TEXT REFERENCES courses(id) ON DELETE SET NULL;
   ALTER TABLE notebooks ADD COLUMN topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL;
   CREATE INDEX IF NOT EXISTS idx_topics_course_order ON topics(course_id,sort_order);
   CREATE INDEX IF NOT EXISTS idx_notebooks_course_topic ON notebooks(course_id,topic_id);
   CREATE TABLE IF NOT EXISTS pdf_search_index (
    page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
    search_text TEXT NOT NULL DEFAULT '', extractable INTEGER NOT NULL DEFAULT 0
   );
   INSERT OR REPLACE INTO settings(key,value) VALUES('schemaVersion','3');
  `);
 }
});
