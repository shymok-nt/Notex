# Notex — Coding Agent Kuralları

Notex, **yerel çalışan, el yazısı odaklı bir defter/not uygulamasıdır**. Hesap veya bulut arka uç zorunluluğu yoktur. Bu dosya, repoda değişiklik yapan bütün coding agent'lar için **uygulanacak kuralları** tanımlar.

**Zorunlu okuma sırası:** Önce bu dosyayı, sonra [NOTEX_DATA_ARCHITECTURE.md](./NOTEX_DATA_ARCHITECTURE.md) dosyasını, ardından görevin ilgili **güncel kaynak kodunu** oku. Rehberde yazan yol/isimleri doğrulamadan varsayma; kod ile belge farklıysa gerçek kodu incele ve belgenin güncellenmesi gerekip gerekmediğini değerlendir.

## 1. Teknoloji ve platformlar

- **Uygulama:** React Native + Expo + TypeScript; yönlendirme Expo Router.
- **Arayüz durumu:** Zustand.
- **Çizim:** React Native Skia, Gesture Handler, Reanimated; vektör kalem/şekil/metin verileri.
- **Kalıcı veri:** Yerel SQLite (`expo-sqlite` / Windows Tauri SQLite köprüsü); **ikinci bir kalıcı not deposu oluşturma**.
- **Platformlar:** Windows/Tauri, Android, iOS ve web. Platforma özgü API'leri diğerlerinde çalışıyormuş gibi kullanma.
- **Dil:** Kullanıcıya görünen metinler Türkçe; stylus ve parmak kullanımını gözet.

## 2. Çalışan kayıt mimarisi — BOZMA

**Tek ortak aktif sayfa durumu:** `store/pageStore.ts` içindeki `usePageStore`.

**Tek kalıcı sayfa kaydı:** `db/repositories/pageRepository.ts` üzerinden SQLite.

**Tek içerik yazma kuyruğu:** `features/canvas/store/pagePersistence.ts`.

**Canvas düzenleme giriş noktası:** `features/canvas/hooks/useCanvasPageContent.ts`.

```text
DrawingCanvas.onChange / metin / görsel / silgi
    -> useCanvasPageContent.change / commit
    -> usePageStore.cacheContent(pageId, serializeContent(next))
    -> enqueuePageSave(pageId, serialized)
    -> 500 ms debounce veya flushPageSave
    -> pageRepository.updateContent
    -> pageRepository.getStoredContent ile kayıt doğrulama
```

- İçerik düzenlemeleri **optimistic** çalışır: Ekrandaki ortak Zustand durumu anında güncellenir; SQLite'a yazım **500 ms debounce** ile yapılır. Her tuşta/darbede senkron SQLite yazma ekleme.
- Aynı sayfaya ait yazmaları **sıralı** tut. `version` ve `savedVersion` mekanizmasını bozma; eski bir yazmanın yeni içerik üzerine yazmasına izin verme.
- Sayfa değişimi öncesi `controller.flush()`/ilgili `flushPageSave()` tamamlanmalı. Kayıt hatasında geçiş başarıyla tamamlanmış gibi gösterilmemeli.
- Kalem/silgi için **aktif çizimin JS commit'i tamamlanmadan** kaydı/çizim bitti sinyalini verme. `DrawingCanvas` içindeki `completeAndNotify` sırasını ve aktif çizimden kalıcı çizgiye handoff'u koru.
- `DrawingCanvas` veya sayfa bileşeninde ayrı bir `useState` not listesi ya da ikinci `PageContent` kaynak sistemi kurma. Skia canvas görüntüsünü kalıcı veri gibi kullanma.
- `localStorage`'ı yeni notlar için ana/yardımcı kayıt deposu olarak yeniden ekleme. `pageStore.ts` içindeki `migrateLegacyDrafts` **yalnızca eski sürümde bekleyen taslakların kurtarılması içindir**; geriye uyumluluk doğrulanmadan silme.
- Kaldırılmış eski `useAutosave.ts`, `pageContentStorage.ts`, `autosavePolicy.ts`, `notesStore.ts`, `useNotesStore.ts` mimarisini yeniden kurma.

## 3. Silme, düzenleme ve boş içerik kuralları

- **Boş string `""`, boş dizi `[]`, `0` ve `false` geçerli değerlerdir.** Bunları `if(content)`, `content || old` gibi truthy kontrolleriyle düşürme. Gerekirse `!== undefined` veya `??` kullan; `null` ile kayıt yokluğunu açıkça ayır.
- Normal boş sayfa `{"v":2,"elements":[]}` olabilir. Tam silme, **değişiklik** sayılır ve kaydedilir; eski `elements` dizisini fallback ile geri getirme.
- Sayfa içeriği mevcut `PageContent v2` formatındadır: `elements` (stroke/shape/text), isteğe bağlı `images`, `backgroundImage` ve `h`. Ayrı bir `strokes` şeması getirip eski verileri düşürme.
- Silgi sonucu vektör elemanlarının kaldırılması/değiştirilmesidir. `features/canvas/engine/pixelEraser.ts` ve `DrawingCanvas.onChange` üzerinden **diğer editlerle aynı kayıt yoluna** girmeli.
- Eski canvas props'larıyla gelen düzenlemeler silinen çizgileri yeniden oluşturmasın: `features/canvas/engine/reconcilePageEdit.ts` içindeki `reconcileById` davranışını koru ve değişiklikte ilgili testi güncelle.
- Metin, şekil, görsel, kalem, silgi, seçim ve undo/redo işlemleri için aynı veri bütünlüğü kurallarını uygula.
- Eski sayfa ve `.notex` yedek biçimlerine geriye uyumu koru. Geçersiz içeriği sessizce boşaltıp veritabanına geri yazma.

## 4. Sayfa CRUD ve yükleme

- **Ekle/sil/taşı/çoğalt/geri yükle/şablon güncelleme:** `pageStore.ts` ve `pageRepository.ts` üzerinden yap. SQLite transaction **başarıyla tamamlanmadan** sayfa CRUD işlemini kalıcı başarı olarak gösterme.
- Sayfa silmeden önce `finishPageSave` / `finishManyPageSaves`; sayfa çoğaltmadan önce `flushPageSave` kurallarını koru.
- Her CRUD veya edit işleminde **tüm defterin sayfa listesini yeniden fetch etme**. Yalnız değişen/yeni sayfaları ortak store'da güncelle.
- `load(id)` yalnızca gerçek defter yüklemesinde çalışmalı; her çizim/silme için `pages: []` atama.
- “Yükleniyor” tam ekran görünümü yalnızca gerçek açılış/ilk yükleme için kullanılmalı; sıradan edit ve kayıtta tüm editörü gizleme veya yeniden oluşturma.
- `useEffect` bağımlılıklarında sürekli değişen obje/fonksiyonlardan doğan tekrar yükleme döngüsüne karşı dikkatli ol.
- Sayfa seçimi normalde `NoteCanvasScreen` içinde seçili sayfa ID'si üzerinden yapılır. Tam sayfa `window.location` yenilemesi ekleme.

## 5. SQLite, migration ve yedek güvenliği

- Mevcut `folders`, `notebooks`, `pages`, `settings` tablolarını koru; kayıt kayboldu diye SQLite dosyasını temizleme, yeniden oluşturma veya kullanıcı verisini silme.
- Var olan migrasyonları yeniden yazma. Şema değişimi gerekiyorsa `db/migrations.ts` içine **yeni sürümlü migrasyon** ekle; eski veri ve yedeklerle test et.
- `pageRepository.updateContent`, doğru sayfa satırını güncellemeli; SQLite geri okuma doğrulamasını kaldırma.
- `services/notexBackup.ts` ve görsel dosya yolu yönetimini göz önünde tut. `.notex` içe/dışa aktarımının eski ve yeni dosyaları açması gerekir.
- Tauri Rust/SQLite köprüsüne veya platforma özgü kalıcı dosyalara müdahalede Windows dışı davranışları da değerlendir.

## 6. Çizim performansı ve davranışı

- Çizim sırasında React state üzerinden ağır iş, SQL veya dosya kopyalama çalıştırma. Aktif UI-thread çizimi, tamamlanmış çizginin JS tarafına aktarımı ve kaydedilmiş vektör verisi ayrı sorumluluklardır.
- Kalem, stylus basıncı, silgi, metin kutusu, görsel yerleşimi, sayfa şablonları, selection handoff ve undo/redo'nun çalışmasını koru.
- Önce çalışan davranışı anlamadan `DrawingCanvas.tsx` içindeki gesture, handoff ve render sırasını “sadeleştirme”.
- Bir performans değişikliğini veri bütünlüğü kontrolünü kaldırarak yapma.

## 7. Zorunlu doğrulama

Değişiklikten sonra kapsamına göre şunları çalıştır:

```bash
npm run typecheck
node --test features/canvas/engine/__tests__/*.test.mjs
```

Kayıt sistemini etkileyen değişiklikler için özellikle:

- `pagePersistence.test.mjs`: boş içerik, 500 ms debounce, sıralı flush, SQLite hata durumu.
- `pageStorePersistence.test.mjs`: ekleme, içeriği tamamen silme, başka sayfaya/deftere gidip geri gelme, kalıcı silme, gereksiz reload olmaması.
- `npm run tauri:dev` ile manuel Windows testi: hızlı kalem/silgi → sayfa değişimi → geri dönüş → uygulamayı kapatıp açma.
- Görsel/PDF/yedek veya Android/web etkisi varsa ilgili platform testleri.

Test **çalıştırılmadıysa** çalıştırılmış gibi raporlama. GitHub Actions testlerinin geçmesi gerçek Tauri kalem/silgi UI testinin yerine geçmez.

## 8. Görev yürütme ve raporlama

1. Göreve başlamadan **ilgili mevcut kodu ve [NOTEX_DATA_ARCHITECTURE.md](./NOTEX_DATA_ARCHITECTURE.md) dosyasını incele**.
2. Yalnızca istenen kapsamı değiştir. Mevcut kullanıcı verilerini ve geriye uyumluluğu koru.
3. Hatanın olası nedenini değiştirilen kod noktalarıyla açıklayabil; yalnızca rastgele yamalar ekleme.
4. Yeni dosya/paket gerekiyorsa mevcut Expo, Skia, Reanimated ve Gesture Handler sürümleriyle uyumluluğunu doğrula.
5. Değiştirilen dosyaları ve çalışma/test sonuçlarını raporla; belirsizlikleri açıkça belirt.
6. Kayıt/çizim/veri modeli değişirse bu dosyanın ve `NOTEX_DATA_ARCHITECTURE.md` belgesinin güncel kalmasını sağla.
7. Kullanıcının açıkça istediği GitHub iş akışı kapsamında commit/PR/merge yap; aksi halde izinsiz kalıcı değişiklik yapma.

**Öncelik:** Çalışan veri kaydı ve kullanıcı notlarının bütünlüğü > yeni özellik veya küçük performans kazanımı.

## 9. Ders / Konu / Arama (v3)

- [COURSES_TOPICS_SEARCH.md](./COURSES_TOPICS_SEARCH.md) belgesini de oku.
- Ders/konu tablosu ve defter `courseId/topicId` alanları **ek metadata**dır; mevcut `PageContent v2` ve SQLite kayıt kuyruğunu değiştirme.
- Eski defterler `NULL/NULL` ile Sınıflandırılmamış görünmelidir. Mevcut notları yükseltmede silme.
- `db/migrations.ts` sürüm 3 öncesi yedek/snapshot ve rollback korumasını bozma.
- Ders/konu CRUD SQLite'a yazılmadan başarılı state güncellemesi yapma; güvenli silme varsayılanı sınıflandırılmamışa taşı, isteğe bağlı silme soft-delete olmalı.
- PDF metnini bir kez içe aktarırken indeksle, aramada yeniden PDF raster etme; `searchIndex` yalnız türetilmiş dizindir.
- `.notex` yedeğine ders/konu bağlarını ve PDF indeksini dahil et; format 1 eski yedekleri kabul etmeye devam et.
- `courseMigration`, `courseRepository`, `courseSearch`, `courseBackup` testlerini çalıştır.
