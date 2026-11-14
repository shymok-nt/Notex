# Notex — Güncel Proje Rehberi

> Son inceleme: 14 Kasım 2026 · Kaynak: `C:\Notex` çalışma ağacındaki kod ve yapılandırma. Bu belge ürünün **kodda görülen** durumunu anlatır; bütün cihaz ve kullanım senaryolarının doğrulandığı anlamına gelmez. Yeni görevde ilgili dosyanın güncel içeriği yeniden okunmalıdır.

## 1. Ürün ve kapsam

Notex, hesap ve sunucu gerektirmeden cihazda çalışan, el yazısı odaklı bir defter uygulamasıdır. Arayüz Türkçedir. React Native ile Expo kod tabanı mobil ve web için paylaşılır; Windows sürümü Expo web çıktısını Tauri 2 içinde çalıştırır. Ana veriler SQLite'ta, kapak ve sayfa görselleri uygulamanın kalıcı dosya alanında tutulur. Zustand, kalıcı verinin yerine geçmez; ekranların bellek durumunu yönetir.

| Platform | Kod yolu | Mevcut durum ve sınır |
| --- | --- | --- |
| Android | Expo / React Native, `expo-sqlite`, `expo-file-system` | Kaynak ve yapılandırma mevcut; bu incelemede gerçek cihaz veya release testi yapılmadı. |
| iOS | Expo / React Native | `app.json` tablet desteği içerir; gerçek cihaz ve mağaza paketi doğrulanmadı. |
| Windows | Tauri 2 + Expo web export + Rust SQLite köprüsü | PDF içe aktarma ve yerel dosya işlemleri burada uygulanmıştır; installer testi yapılmadı. |
| Tarayıcı | React Native Web + Expo SQLite web | Web Locks ile aynı veritabanına eşzamanlı erişim kısıtlanır. Görsel dosyası içeren yedeğin webde güvenli geri yüklenmesi desteklenmiyor. |

## 2. Teknoloji ve sürümler

`package.json` ve `src-tauri/Cargo.toml` temel alınmıştır.

| Alan | Teknoloji |
| --- | --- |
| Uygulama | Expo `~58.0.23`, React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3` |
| Navigasyon | Expo Router `~58.0.30` |
| Canvas | React Native Skia `2.14.0`, Gesture Handler `~3.3.0`, Reanimated `4.7.1`, Perfect Freehand |
| Veri ve durum | Expo SQLite `~58.0.15`, Zustand `^5.0.8` |
| Masaüstü | Tauri JavaScript API `^2.12.4`; Rust tarafında Tauri `2.12.5`, `rusqlite` `0.42.0` |
| PDF ve yedek | PDF.js `5.4.624`, JSZip `^3.10.1` |

Sürüm uyumluluğu ayrıca kontrol edilmelidir: 14 Kasım 2026'da `npm run check`, Expo'nun beklediği bazı yama sürümleri kurulu sürümlerden yeni olduğu için başarısızdır. Bu durum TypeScript hatası değildir; sürümler kontrollü güncellenip platformlarda tekrar denenmelidir.

## 3. Dizinler ve giriş noktaları

```text
app/                     Expo Router ekranları ve rotalar
components/              Kütüphane, kapaklar, önizleme, defter oluşturma ikonu
screens/                 Arama ve eski not ekranı bileşenleri
features/canvas/         Canvas bileşenleri, motor, otomatik kayıt, geçmiş
db/                      SQLite açılışı, migrasyonlar, Tauri adaptörü, repository'ler
store/                   Zustand durumları
services/notexBackup.ts  .notex yedekleme ve geri yükleme
utils/                   PDF, dosya, arama ve platform yardımcıları
theme/                   Tema, renkler, fontlar, kapaklar
types/                   Defter, sayfa ve diğer veri tipleri
src-tauri/               Rust köprüsü, yetkiler, Windows paketleme
scripts/                 PDF.js varlıkları, Tauri statik sunucu, kapak üretimi
assets/                  Uygulama ikonu, fontlar ve kapak görselleri
```

`app/_layout.tsx` açılışta defter ve ayar durumlarını yükler, fontları hazırlar, tema sağlayıcısını ve rota ağacını kurar. `app/(tabs)/_layout.tsx` görünür **Ana sayfa**, **Defterler** ve **Ara** sekmelerini tanımlar. Klasör ve Favoriler ekranları rota olarak vardır ancak sekme çubuğunda gizlidir. Defter düzenleyicisi `app/notebook-editor.tsx`; canvas ekranı `app/note/[id].tsx` üzerinden `features/canvas/components/NoteCanvasScreen.tsx` dosyasına yönlenir.

## 4. Kullanıcıya açık iş akışları

### Kütüphane ve defterler

- `components/LibraryDashboard.tsx` ana ekranı; `components/NotebookLibrary.tsx` defter listesini sunar. Defter oluşturma düğmeleri ortak `components/CreateNotebookIcon.tsx` vektör bileşenini kullanır. Güncel ikonun siyah zemini ve opak indigo, mor, pembe kalemi vardır.
- Defter adı, kapak rengi/görseli/ön ayarı, kapakta başlık, sayfa şablonu, kâğıt rengi ve klasör seçilebilir. `notebookRepository.create()` ilk sayfayı aynı transaction içinde oluşturur.
- Klasör oluşturma, ad değiştirme, sıralama ve silme `app/(tabs)/folders.tsx` ile `folderRepository` içindedir. Klasör silinince defterler yabancı anahtar davranışıyla klasörsüz kalır.
- Favori, arama, sıralama, ızgara/liste görünümü, yakın zamanda açılan defterler ve son sayfayı hatırlama kodda bulunur.
- Defter silme yumuşak silmedir (`deleted_at`). Silinenler ekranından geri yükleme veya kalıcı silme yapılır. `notebookStore.hydrate()` 30 günü geçmiş silinenleri temizlemeyi tetikler; bu yüzden açılışta veri silme davranışı değiştirilirken özellikle dikkat gerekir.

### Sayfa ve çizim

- Mantıksal sayfa boyutu `PAGE_WIDTH=1000`, `PAGE_HEIGHT=1414`; `PageContent.h` ile yükseklik uzayabilir.
- `PageContent` sürümü `v:2`; `elements` çizgi, şekil ve metin içerir. `images` ve `backgroundImage` isteğe bağlıdır. Boş içerik `{v:2,elements:[]}` olarak üretilir.
- Kalem/vurgulayıcı, basınç verisi, parmak veya desteklenen stylus girişi, piksel/çizgi silgisi, seçim/kement, şekil, metin, görsel ekleme, yakınlaştırma, taşıma, geri al/ileri al kodda bulunur. Gerçek stylus ve palm rejection davranışı cihaza bağlıdır.
- `DrawingCanvas.tsx` Skia render ve jestleri yürütür. `features/canvas/engine/` çizgi geometrisi, silgi, şekil, seçim ve aktif çizginin kalıcı çizgiye geçişi için yardımcıları içerir. `features/canvas/store/history.ts` sayfa bazlı undo/redo durumunu tutar.
- `features/canvas/engine/recognizeShape.ts` el çizimini geometrik şekle dönüştürür. **Metin OCR'si değildir.** Metin OCR entegrasyonu ve araç dosyaları kaldırılmıştır. Eski migrasyon sütunları yalnızca mevcut veritabanlarıyla uyumluluk için durur; uygulama bunları kullanmaz.

### Otomatik kayıt ve sayfa değiştirme

`CanvasPage`, içerik değişikliğinde yerel state, sayfa önbelleği ve `useAutosave` durumunu günceller. Kayıt politikası boşta 2,5 saniye, kesintisiz düzenlemede en çok 15 saniye ve hatada 5 saniye yeniden deneme olarak tanımlıdır. Yazmalar sayfa kimliğiyle sıraya alınır. Repository, güncellemenin bir satırı etkilediğini kontrol eder; ardından kayıt SQLite'tan geri okunup karşılaştırılır. Sayfa geçişi önce `flush()` bekler; açık metin kutusu kapatılır ve aktif çizim tamamlanana kadar beklenir. Kayıt hatasında geçiş durdurulur ve kullanıcıya hata gösterilir. Bunlar kod davranışlarıdır; hızlı kalem/silgi/metin geçişleri Windows ve mobil cihazlarda ayrıca elle sınanmalıdır.

## 5. SQLite ve veri bütünlüğü

`db/database.ts` tek bağlantıyı açar, yabancı anahtarları ve WAL'i etkinleştirir, `PRAGMA user_version` ile migrasyonları çalıştırır. Yerel mobilde exclusive transaction; webde Expo SQLite'ın desteklediği transaction; Tauri'de `db/tauriDatabase.ts` üzerinden Rust transaction komutları kullanılır. Web bağlantısı Fast Refresh sırasında aynı global durumdan yararlanır ve Web Locks ile başka sekmeye karşı korunur.

| Tablo | Amaç |
| --- | --- |
| `folders` | Klasörler ve sıra |
| `notebooks` | Defter bilgisi, kapak, favori, silinme zamanı |
| `pages` | Deftere bağlı sayfalar, sıra, şablon, JSON içerik ve önizleme yolu |
| `settings` | Tema, çizim ayarları ve diğer tercihler |

Migrasyon `1` temel tabloları oluşturur; migrasyon `2` tarihsel otomatik dönüştürme sütunlarını ekler. **Eski migrasyonları değiştirmeyin veya kullanıcı veritabanını sıfırlamayın.** Yeni şema için yeni sürüm ve eski veritabanı kopyasında doğrulama gerekir. `db/repositories/` CRUD, toplu sayfa işlemleri ve transaction sınırlarının sahibidir; doğrudan ekran içinden SQL yazılmamalıdır.

## 6. Görseller, PDF ve platform ayrımı

Mobil dosya işlemleri `expo-file-system` ile; Windows işlemleri `utils/tauriFiles.ts` ve Tauri FS/dialog eklentileriyle yapılır. Tauri kalıcı varlık klasörleri `covers/`, `images/`, `page-assets/`, `thumbnails/` olarak sınırlandırılmıştır. `src-tauri/capabilities/default.json` ve `src-tauri/tauri.conf.json` dosya erişim kapsamlarını tanımlar. Bu klasörler ve kullanıcı SQLite veritabanı build/kurulum işlemlerinde silinmemelidir.

PDF içe aktarma düğmesi yalnızca Tauri masaüstünde görünür. `utils/pdfImport.web.ts` PDF.js ile sayfaları sırayla açar, en uzun kenarı en çok 1600 piksel hedefleyen PNG ve 96 piksel genişliğinde önizleme üretir, `page-assets/` içine yazar. PDF sayfaları düzenlenebilir PDF nesnesi veya seçilebilir metin olarak değil, `backgroundImage` olarak saklanır. Başarısız hazırlığın dosyaları temizleme yolu ve defter/sayfa ekleme transaction'ı vardır. Çok sayfalı PDF'lerde süre, RAM ve disk maliyeti cihazda ölçülmelidir. `utils/pdfImport.ts` diğer platformlarda desteklenmeyen içe aktarma için ayrı giriş noktasıdır.

## 7. `.notex` yedeği

`services/notexBackup.ts` JSZip içinde `manifest.json`, `data.json` ve `files/` varlıklarını kullanır. Aktif defterler, sayfalar, klasörler, ayarlar, kapaklar, sayfa görselleri, PDF arka planları ve önizlemeler toplanır; Silinenler dahil edilmez. Geri yükleme yeni defter kimlikleri üretir ve kayıtları transaction içinde ekler. Yazılmış dosyalar hata halinde temizlenmeye çalışılır. `app/backup.tsx` platforma göre kaydetme ve dosya seçimini sunar.

Biçim `format:1` olarak doğrulanır. Eksik/bozuk varlıklarda hata verilir. Web tarayıcısında dosya varlığı içeren yedeğin geri yüklenmesi açıkça engellenir; boş dosyalı yedek davranışı ayrıca sınanmalıdır. Büyük ve eski `.notex` arşivleri için gerçek cihazda round-trip testi yapılmış kabul edilmemelidir.

## 8. Tema, erişilebilirlik ve arayüz

`theme/ThemeProvider.tsx` sistem/açık/koyu temayı yönetir. `theme/colors.ts`, font ve kapak dosyaları görsel temeli oluşturur. Ayarlar ekranı kalem/parmak modu, basınç hassasiyeti, varsayılan şablon ve kâğıt rengini kaydeder. Birçok eylem Türkçe erişilebilirlik etiketi taşır; kapsamlı ekran okuyucu ve kontrast denetimi yapılmadı.

## 9. Geliştirme ve kontrol komutları

```bash
npm install
npm start
npm run android
npm run ios
npm run web
npm run typecheck
npm run check
node --test features/canvas/engine/__tests__/*.test.mjs components/__tests__/*.test.mjs theme/__tests__/*.test.mjs utils/__tests__/*.test.mjs
npm run tauri:export
npm run tauri:dev
npm run tauri:build
```

`tauri:export` PDF.js varlıklarını hazırlar ve Expo web çıktısını `dist/` içine üretir. `tauri:build` NSIS installer oluşturur ve yalnızca gerçekten gerektiğinde çalıştırılmalıdır. `package.json` içinde `npm test` script'i yoktur; mevcut testler Node test runner ile çalışır.

**14 Kasım 2026 kaynak kontrolü:** `npm run typecheck` geçti; listelenen Node testlerinde **56/56** test geçti; önceki ikon değişikliğinden sonra `npm run tauri:export` geçti. `npm run check`, Expo paket yama sürümü uyuşmazlıklarından dolayı geçmedi. Android/iOS gerçek cihaz, Windows installer ve büyük yedek/PDF testleri bu incelemede yapılmadı.

## 10. Bilinen sınırlar ve öncelikli riskler

1. Sayfa değişimindeki otomatik kayıt için korumalar var; hızlı yazma/silme, metin düzenleme, uygulamayı arka plana alma ve işlem sırasında kapanma senaryoları cihazda tekrar doğrulanmalıdır.
2. `parseContent` eski veya geçersiz içerik için güvenli boş içerik döndürebilir. Eski yedek ve sayfa verileriyle geriye uyum testi önemlidir.
3. Tauri dışındaki PDF içe aktarma kodu desteklenmeyen yol olarak kalır. PDF kaynak metin katmanı korunmaz.
4. Çok büyük sayfalarda Skia çizimi, undo/redo, SQLite JSON yazımı ve PDF rasterlaştırma performansı ölçülmelidir.
5. Webde görsel varlıklı yedek geri yükleme desteklenmiyor; çok sekmeli SQLite erişimi tarayıcıya bağlıdır.
6. Expo uyumluluk kontrolü başarısızdır. Yama sürümü güncellemesi ayrı değişiklik olarak planlanıp test edilmelidir.
7. Kök `README.md` bazı eski ürün durumlarını anlatır; bu rehber güncel kaynak incelemesine dayanır. Yalnızca adı geçen dosyanın varlığı cihazda sorunsuz çalıştığını kanıtlamaz.
8. Tauri `csp` değeri `null`; üretim güvenlik yapılandırması ayrıca gözden geçirilmelidir.

## 11. Değişiklik yapacak agent için kurallar

- Önce `AGENTS.md`, bu rehber ve ilgili güncel kaynak dosyalarını oku. Belgedeki dosya yollarını işlem öncesi doğrula.
- Yalnızca istenen kapsamda çalış; kullanıcı verisi, Skia çizim geçişi, undo/redo ve platformlar arası davranışı koru.
- SQLite migrasyonlarını geriye dönük değiştirme; veri silme veya sıfırlamayla hata çözme. Yeni içerik türünde render, kayıt, yedekleme ve geri yüklemeyi birlikte değerlendir.
- Windows/Tauri dosya API'lerini Android'e taşımadan platform ayrımını doğrula. Çizim anında ağır dosya veya veritabanı işi çalıştırma.
- İlgili testleri, `typecheck` ve gerektiğinde export'u çalıştır; manuel doğrulanmayan davranışı açıkça bildir.
- Kullanıcının izni olmadan commit/push, branch/merge veya production installer build yapma. Kullanıcının yerel değişikliklerini ve gizli dosyalarını koru.

## 12. Belgenin bakım kuralı

Bu dosya güncel kaynak kodunu açıklamak için tutulur. Büyük özellik, şema, platform, yedek biçimi veya güvenilirlik davranışı değiştiğinde ilgili bölümü ve doğrulama tarihini güncelleyin. Kod ile belge çelişirse kodu esas alın ve belgeyi düzeltin.
