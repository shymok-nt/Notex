# Notex

Notex, yerel çalışan, el yazısı odaklı bir defter uygulamasıdır. React Native, Expo Router ve TypeScript kullanır. Windows masaüstünde Tauri ve web tabanlı arayüz kullanır. Expo Router ve React Native Web, Windows masaüstü arayüzünün mevcut altyapısıdır; mobil platformlar güncel ürünün hedef kapsamı değildir. Hesap veya bulut arka uç zorunlu değildir.

## Başlatma ve doğrulama

```bash
npm ci
npm run web
npm run tauri:dev
```

`npm run tauri:dev` Windows masaüstü geliştirme uygulamasını açar; `npm run tauri:build` Windows paketi üretir. `app/` ve `index.web.ts` masaüstü arayüzü için gereklidir; Expo/React Native Web paketlerini mobil kalıntısı sanarak kaldırmayın. Değişikliklerden sonra kapsamına göre:

```bash
npm run typecheck
node --test features/canvas/engine/__tests__/*.test.mjs
```

Gerçek kalem, silgi, sayfa geçişi ve yeniden açma akışlarını hedef platformda ayrıca test edin. Lasso seçiminde taşıma, art arda büyütme/küçültme, taşıma-sonrası-ölçekleme ve metin kutusu çift tıklama akışlarını da doğrulayın.

## Özellikler

- Defter oluşturma ve düzenleme; kapak, şablon, klasör, favoriler, sıralama, silinenler ve geri yükleme.
- Skia sayfa editöründe kalem, vurgulayıcı, şekil, metin, görsel, lasso seçim, taşıma, köşeden büyütme/küçültme, silgi, undo/redo, uzayan sayfa ve PDF arka planı.
- Windows/Tauri'de PDF içe aktarma: PDF kaynak dosyasını yerel saklama, sayfa metaverisini okuyup defteri hızlı açma, JPEG arka planları en fazla iki eşzamanlı iş ile arka planda oluşturma, seçili sayfaya öncelik verme, hata/yeniden deneme ve kayıp arka planı onarma.
- Defter başlığı araması, tema ve kalem ayarları.
- `.notex` dışa ve içe aktarma. Biçim 1 ve 2 yedekleri okunur; eski biçim 2 arşivlerindeki kart verileri artık içe aktarılmaz.

## Kod haritası

| Konum | Sorumluluk |
| --- | --- |
| `app/` | Expo Router ekranları ve sekmeler |
| `features/canvas/` | Çizim, vektör içerik ve kayıt kuyruğu |
| `store/` | Zustand durumları |
| `db/` | SQLite bağlantısı, migrasyonlar ve repository'ler |
| `services/notexBackup.ts` | Yedekleme ve geri yükleme |
| `src-tauri/` | Masaüstü köprüsü |
| `utils/pdfImport.web.ts` | PDF metaverisi ve JPEG sayfa üretimi |
| `utils/pdfRenderQueue.web.ts` | PDF arka plan kuyruğu, öncelik, hata ve onarım |
| `utils/tauriFiles.ts` | Yerel PDF/görsel dosyaları |

Sayfa içeriği `PageContent v2` JSON olarak `pages.content` alanında saklanır. Düzenleme önce `usePageStore` durumuna yansır. `pagePersistence.ts` içindeki sayfa bazlı kuyruk 500 ms debounce uygular; sayfa geçişi bekleyen yazmayı tamamlar ve SQLite geri okumasıyla doğrular. Sayfa CRUD işlemleri repository transaction'ından sonra ortak store'a yansır.

`db/migrations.ts` içindeki güncel şema sürümü **5**'tir. Sürüm 1–4 geçmiş kurulumların geçiş zincirini korur; sürüm 5 kart tablolarını, tetikleyicilerini ve ayarlarını kaldırır. Eski migrasyonları yeniden yazmayın.

Ayrıntılı veri ve kayıt akışı için [NOTEX_DATA_ARCHITECTURE.md](./NOTEX_DATA_ARCHITECTURE.md), kod değişikliği kuralları için [AGENTS.md](./AGENTS.md) dosyasına bakın.

## Lasso taşıma ve ölçekleme (15 Kasım 2026)

`features/canvas/components/DrawingCanvas.tsx` içindeki seçili vektör/metin öğeleri, taşıma ve büyütme/küçültme sırasında **sabit `frozenSelection` geometrisi** üzerinden çizilir. Reanimated `committedDX/committedDY` ve `committedScale` değerleri gesture bırakılırken UI thread'de biriktirilir; `commitSelectionMove` ve `commitResize` güncel `moveBaselineRef` üzerinden sayfa içeriğini `onChange` ile kaydeder. Taşıma/ölçekleme kayıt onayı, seçili Skia geometrisini anında değiştirmez. Hit-test birikmiş kaydırma ve ölçeği hesaba katar. Bu yol, döndürme için mevcut `commitGesture`/handoff yolundan ayrıdır. `selectionHandoff.ts` yardımcılarını kaldırmayın.

- [PR #42 — taşıma sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/42)
- [PR #43 — büyütme/küçültme sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/43)

Kullanıcı Windows/Tauri üzerinde taşıma ve büyütme/küçültme sıçramalarının düzeldiğini bildirmiştir. Bu gözlem diğer platformlar veya bütün köşe durumları için otomatik test garantisi değildir.

## PDF defterlerinin güncel işleyişi (16 Kasım 2026)

Windows/Tauri üzerinde `preparePdfImport` seçilen PDF'yi uygulama verisine kopyalar; sayfa boyutları ve `pdfSource: {file,pageIndex}` ile `pdfPageLayout` bilgilerini `PageContent v2` içine kaydeder. Defter, bütün sayfaların JPEG olarak işlenmesini beklemeden açılır. `resumePdfNotebook` eksik arka planları kuyruğa alır; `prioritizePdfPage` seçili sayfayı öne çeker. `renderPdfPage` arka plan ve küçük resmi `page-assets/*.jpg` olarak üretir. Kuyruk aynı anda en fazla iki iş yürütür.

`pageStore.load` sayfaların hafif metaverisini yükler; `hydrateAround` seçilen sayfa ve yakınındaki sayfaların tam içeriğini SQLite'dan getirir. `complete`, `flushPageSave` sonrası sayfa içeriğine arka plan ekler. Bu iki yolun eşzamanlı çalışmasında yeni küçük resim ve PDF arka planını korumaya yönelik uzlaştırma kodu bulunur. PDF yükleme/render başarısızlıklarında durum ve tekrar deneme gösterilir; eksik arka plan görseli yeniden oluşturulabilir. Kaynak PDF `pdf-sources/` altında tutulur ve `.notex` yedeğine dahil edilir.

**Sınırlar:** Bu yol Tauri/web'e özeldir; diğer platformlarda PDF içe aktarma desteği varsayılmamalıdır. URL ile PDF okuma 15 saniyelik sınırdan sonra yerel baytlara düşer; render 30 saniye sınırı ve iki tekrar denemesi kullanır. Bunlar kodda bulunan korumalardır, her tür PDF'de garanti edilen performans süreleri değildir. Büyük PDF, eksik kaynak, bozuk JPEG, eşzamanlı çizim ve yedek geri yükleme senaryoları Windows'ta ayrıca doğrulanmalıdır.

**Son kullanıcı doğrulaması:** `NoteCanvasScreen.tsx` içinde `selectedId` tanımlanmadan önce bağımlılık dizisinde okunmasından kaynaklanan açılış çökmesi, `f8b7eaf` commit'iyle giderildi; kullanıcı ekranın düzeldiğini bildirdi. Bu bildirim tüm PDF sayfalarının sorunsuz render edildiği anlamına gelmez.
