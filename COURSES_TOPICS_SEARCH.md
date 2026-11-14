# Notex — Ders, Konu ve Yerel Arama

> **Teknik durum:** 14 Kasım 2026; bu özelliği kullanan kod ve testler ile birlikte güncellenir.
>
> Notex'in asıl not nesnesi **defterdir** (`notebooks`), defterin içindeki el yazısı/metin/PDF sayfaları `pages` tablosundadır. Var olan `PageContent v2` ve 500 ms'lik SQLite yazma kuyruğu değiştirilmemiştir.

## Veri yapısı ve geçiş

- `courses(id,name,color,icon,sort_order,created_at)`
- `topics(id,course_id,name,sort_order,created_at)`
- `notebooks.course_id` ve `notebooks.topic_id`: nullable; eski notlar `NULL/NULL` ile **Sınıflandırılmamış** görünür.
- `pdf_search_index(page_id,search_text,extractable)`: yalnız yerel, PDF sayfa bazlı türetilmiş metin indeksi.
- `settings.schemaVersion='3'`, `PRAGMA user_version=3`; `db/migrations.ts` migrasyon 3 yalnız bir kez uygulanır.
- Migrasyon başlamadan aynı SQLite içinde `migration_v3_notebooks_backup` ve `migration_v3_pages_backup` snapshot tabloları hazırlanır. **Windows/Tauri** yükseltmesinde ayrıca kullanıcı uygulama verisi alanına `notex-before-courses-v3.db` dosyası kopyalanır; dosya zaten varsa üzerine yazılmaz. Yedek başarısızsa v3 migrasyonu başlamaz.
- Önceki kayıtların `content` JSON metni ve `pages` satırları değişmez. Hatalı migrasyon transaction rollback yapar.

## İşlem katmanları

- `db/repositories/courseRepository.ts`: ders ve konu CRUD, not taşıma, ders/konu silerken notları sınıflandırılmamışa alma veya defteri çöp kutusuna (soft-delete) taşıma.
- `store/courseStore.ts`: Zustand ders/konu listesi, seçim ve açık dallar. Açık/kapalı durum `settings.courseTreeExpanded` üzerinden kalıcıdır.
- `types/course.ts`: ders, konu ve silme modu.
- `components/CourseSidebar.tsx`: FlatList tabanlı ders–konu–not ağacı, isim/ikon/renk düzenleme, güvenli silme diyaloğu; geniş ekranda sol panel, dar ekranda çekmece.
- `components/NotebookLibrary.tsx`: seçilen ders/konuya göre not listesi, sağ tık veya menü ile taşıma ve web sürükle-bırak.
- `app/notebook-editor.tsx`: yeni defter, seçili ders/konuyla oluşturulur.
- `features/canvas/components/NoteCanvasScreen.tsx`: üst bilgi alanında tıklanabilir ders › konu yolu.

## Arama

- `utils/pdfImport.web.ts` PDF.js `getTextContent()` ile metni **içe aktarma sırasında tek kez** çıkarır.
- `notebookRepository.createFromPdf`, PDF metnini `pdf_search_index` tablosuna aynı transaction içinde kaydeder. Metin katmanı bulunmazsa `extractable=0`; PDF raster görseli yine normal şekilde içe aktarılır. **Önceki sürümlerde içe aktarılmış PDF'lerin kaynak PDF'i saklanmadığından** onların metnini sonradan çıkaramayız; aranması için yeniden içe aktarılması gerekir.
- `features/search/searchIndex.ts`: bütün dijital metin öğeleri ve PDF metni bir kez okunarak bellekte indekslenir. Bir sayfa düzenlenince sadece o sayfa 200 ms sonra yeniden indekslenir; ekleme/silme ile ilgili girdi güncellenir.
- Türkçe normalleştirme: `toLocaleLowerCase('tr-TR')`, `ı→i`, Unicode NFD aksan temizleme. `ogrenci` sorgusu `Öğrenci` ile eşleşir.
- `screens/CourseSearchScreen.tsx`: 200 ms arama debounce, eşleşen kısa önizleme ve vurgulama, sadece seçili ders filtresi, sanallaştırılmış sonuç listesi ve PDF sayfasına yönlendirme. Masaüstünde **Ctrl+K** aramayı açar; varsayılan tarayıcı Ctrl+F davranışı değiştirilmez.
- El yazısı stroke'ları OCR ile aranmaz; stroke'ların bulunduğu defterler başlıkları/bağlı ders ve konu isimleriyle bulunabilir.

## Yedekleme ve uyumluluk

`services/notexBackup.ts`, `.notex` formatı **1** olarak korunurken manifest'e `schemaVersion:3` ekler. `data.json` içine `courses`, `topics`, `pdfSearchIndex` ve defterlerin `course_id/topic_id` alanları yazılır. İçe aktarmada kimlikler yeniden oluşturulur ve aralarındaki ilişkiler yeniden eşlenir. Eski yedeklerde yeni alanlar yoksa `[]` ve `null` kabul edilir; notlar sınıflandırılmamışa gider. Görseller, PDF PNG varlıkları ve eski içerik biçimi değişmez.

## Kaydetme güvencesi

Ders/konu ekleme, yeniden adlandırma, silme ve not taşıma, önce SQLite transaction'ını tamamlar, sonra ortak Zustand state'ini günceller. Çizim/metin/silgi işlemleri **eskisi gibi** `usePageStore.cacheContent` + `pagePersistence` (500 ms/flush) yolundan gider. PDF metin indeksi asıl sayfa içeriğinin ikinci bir kopyası değil, arama amaçlı türetilmiş veridir.

## Test ve doğrulama

```bash
npm run typecheck
node --test features/canvas/engine/__tests__/*.test.mjs
npm run tauri:dev
```

İlgili test dosyaları: `courseMigration.test.mjs`, `courseRepository.test.mjs`, `courseSearch.test.mjs`, `courseBackup.test.mjs`, mevcut `pagePersistence.test.mjs` ve `pageStorePersistence.test.mjs`.

**Manuel kontrol:** Eski veritabanıyla yükseltme, ders/konu oluştur → uygulamayı yeniden aç, not taşı, güvenli ders silme, taranmış PDF bilgi metni, gerçek metinli PDF'de sayfaya gitme, eski ve yeni yedek geri yükleme, 500+ notta gerçek pencere performansı, Windows sürükle-bırak/sağ tık. Otomatik Node testleri gerçek Tauri arayüzü testinin yerine geçmez.

**Önemli sınırlar:** Windows haricindeki platformlarda bağımsız `.db` yedek dosyası hazırlama komutu yoktur; SQLite içi snapshot ve transaction rollback korunur. Önceki PDF'lerin metin katmanları saklanmadığı için geriye dönük PDF metni indekslenmez.
