# Notex — Coding Agent Kuralları

Notex, **yerel çalışan, el yazısı odaklı bir defter/not uygulamasıdır**. Hesap veya bulut arka uç zorunluluğu yoktur. Bu dosya, repoda değişiklik yapan bütün coding agent'lar için **uygulanacak kuralları** tanımlar.

**Zorunlu okuma sırası:** Önce bu dosyayı, sonra [NOTEX_DATA_ARCHITECTURE.md](./NOTEX_DATA_ARCHITECTURE.md) dosyasını, ardından görevin ilgili **güncel kaynak kodunu** oku. Rehberde yazan yol/isimleri doğrulamadan varsayma; kod ile belge farklıysa gerçek kodu incele ve belgenin güncellenmesi gerekip gerekmediğini değerlendir.

## 1. Teknoloji ve platformlar

- **Uygulama:** React Native + Expo + TypeScript; yönlendirme Expo Router.
- **Arayüz durumu:** Zustand.
- **Çizim:** React Native Skia, Gesture Handler, Reanimated; vektör kalem/şekil/metin verileri.
- **Kalıcı veri:** Yerel SQLite (`expo-sqlite` / Windows Tauri SQLite köprüsü); **ikinci bir kalıcı not deposu oluşturma**.
- **Aktif ürün hedefi:** Windows/Tauri masaüstü. Expo Router ve React Native Web masaüstü arayüzünün altyapısıdır; Android/iOS'u güncel desteklenen ürün hedefi gibi belgeleme. Platforma özgü API'leri başka platformlarda çalışıyormuş gibi kullanma.
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
- Sayfa içeriği mevcut `PageContent v2` formatındadır: `elements` (stroke/shape/text), isteğe bağlı `images`, `backgroundImage`, `pdfSource`, `pdfPageLayout` ve `h`. Ayrı bir `strokes` şeması getirip eski verileri düşürme.
- Silgi sonucu vektör elemanlarının kaldırılması/değiştirilmesidir. `features/canvas/engine/pixelEraser.ts` ve `DrawingCanvas.onChange` üzerinden **diğer editlerle aynı kayıt yoluna** girmeli.
- Eski canvas props'larıyla gelen düzenlemeler silinen çizgileri yeniden oluşturmasın: `features/canvas/engine/reconcilePageEdit.ts` içindeki `reconcileById` davranışını koru ve değişiklikte ilgili testi güncelle.
- Metin, şekil, görsel, kalem, silgi, seçim ve undo/redo işlemleri için aynı veri bütünlüğü kurallarını uygula.
- Güncel silgi davranışında `pixelEraser.ts` metin öğelerini korur; metin silme düzenleme veya seçim eyleminden geçer. Metin biçimindeki isteğe bağlı `italic`/`underline` alanları eski `PageContent v2` kayıtlarını geçersiz kılmamalıdır.
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
- **Lasso taşıma/ölçekleme:** `frozenSelection` çizilen geometriyi sabit tutar; `committedDX/committedDY` ve `committedScale` gesture sonunda UI thread'de birikir. `commitSelectionMove`/`commitResize` sadece güncel `moveBaselineRef` üzerinden içeriği kalıcılaştırır; taşıma/ölçekleme kayıt onayıyla seçim geometrisini değiştirip shared transform'u sıfırlama. Hit-test, birikmiş konum ve ölçeği izlemeli. Döndürme ve diğer handoff davranışlarını ayrı koru (PR #42 ve #43).
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
- Görsel/PDF/yedek veya platform uyumluluğu etkisi varsa ilgili platform testleri.
- Lasso değişikliklerinde Windows'ta art arda taşıma, büyütme/küçültme, taşıma→ölçekleme, ölçekleme→taşıma, metin kutusu çift tıklama ve undo/redo regresyonlarını denetle.

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

## Kaldırılmış flashcard özelliği

- Flashcard arayüzü, store, repository, zamanlayıcı ve testleri kaldırılmıştır; yeniden eklemeyin.
- SQLite şema sürümü **5**: geçmiş migrasyonlar 1–4, eski kurulumların yükseltilebilmesi için korunur. Migrasyon 5, `card_reviews`, `cards`, `card_decks` tablolarını ve ilgili tetikleyici/ayarları siler. Bu veri silme işlemi kullanıcı tarafından özellikle istendi; defter ve sayfa tablolarına dokunma.
- Eski `.notex` biçim 2 yedekleri okunmaya devam eder ancak kart verileri içe aktarılmaz. Yeni yedekler kart verisi üretmez.

## 9. Güncel PDF defteri koruma kuralları (16 Kasım 2026)

- **Tembel içe aktarma:** `utils/pdfImport.web.ts` PDF kaynak dosyasını `pdf-sources/` altına kopyalar ve önce yalnızca `pdfSource` / `pdfPageLayout` metaverisini oluşturur. PDF'yi açmadan önce bütün sayfaları rasterize eden eski yolu geri getirme.
- **Arka plan kuyruğu:** `utils/pdfRenderQueue.web.ts` en fazla iki eşzamanlı sayfa işler; seçili sayfa önceliklidir. `complete`, SQLite'daki mevcut içeriği transaction içinde birleştirir. Çizimleri, metni, görselleri veya PDF kaynak bilgisini sıfırlama. `DrawingCanvas` içerik üretirken mevcut `PageContent` metaverisini korumalıdır.
- **Hafif yükleme:** `pageRepository.getByNotebook` yalnızca hafif satırları getirir ve `contentLoaded:false` kullanır; `pageStore.hydrateAround` seçili sayfa çevresinin tam içeriğini getirir. Tam içeriği yüklenmemiş sayfada düzenlemeyi doğrudan kayda gönderme. Arka plan üretimi ile hydrate aynı anda biterse yeni `thumbnailPath` ve `backgroundImage` korunmalıdır.
- **Hata yönetimi:** `pdfSource` mevcut fakat arka plan eksikse hazırlanma durumu göster; kaynak/render hatasında tam hata ve yeniden deneme sun. URL okuma için 15 sn, render için 30 sn sınırı ve iki yeniden deneme kodda tanımlıdır. Eksik JPEG için `repairPdfBackground` yeniden kuyruğa alma yoludur. Hata mesajlarını `[Notex PDF]` önekiyle kaydet.
- **Kaynak yaşam döngüsü:** PDF kaynak dosyaları ve oluşturulan JPEG'ler silme ve `.notex` yedekleme/geri yüklemede hesaba katılmalı. `releasePdfNotebook` belge önbelleğini kapatma yoludur. Kaynak PDF'yi kullanıcı verisi olarak koru; silinen bir arka plan görseli ile asıl PDF dosyasını karıştırma.
- **React başlatma sırası:** `useEffect` / `useMemo` / `useCallback` bağımlılık dizilerinde kullanılan `const` / `let` değişkenleri ilgili hook'tan önce tanımlanmış olmalı. Özellikle `NoteCanvasScreen.tsx` içinde `selectedId` tanımını PDF önceliklendirme effect'inin altına taşıma; bu düzen `f8b7eaf` ile açılış çökmesini düzeltti.
- **Geriye uyumluluk:** Eski `backgroundImage` içeren PNG defterler `pdfSource` gerektirmeden açılmalı. Kalem, silgi, undo/redo, sayfa geçişi ve yedekleme davranışını PDF performansı için değiştirme.
- **Regresyon:** Büyük PDF açma, ilk sayfanın hazırlanması, hızlı sayfa geçişi, aynı sayfada çizim + arka plan commit'i, eksik kaynak, bozuk/kayıp JPEG, hata sonrası tekrar deneme, kapatıp açma ve `.notex` geri yükleme senaryolarını gerçek Windows/Tauri uygulamasında test et. Bunların tamamının geçtiği henüz belgelenmiş değildir.
