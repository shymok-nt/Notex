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
export const latestMigrationVersion=2;
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
