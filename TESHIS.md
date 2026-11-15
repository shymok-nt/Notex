# Notex çizim ekranı — kaynak kod teşhisi ve güncel PDF durumları

> **15 Kasım 2026 (`main`, PR #43 sonrası) güncellemesi:** Bu belge tarihsel bir statik performans teşhisidir. Güncel `NoteCanvasScreen.tsx` içinde `onHistory={()=>{}}` kullanılır; aşağıdaki `setHistoryVersion` render zinciri artık geçerli değildir. Sayfa sarmalayıcısında `marginHorizontal`, `marginTop`, `marginBottom` ve `borderRadius` artık `0`'dır; aşağıdaki kenar/gölge teşhisi eski sürüme aittir. Kayıt gecikmesi `pagePersistence.ts` içinde 500 ms'dir. Güncel performans sonucu için cihaz ölçümü gerekir.

> İnceleme: kaynak kod üzerinden statik teşhis. Gerçek cihaz React Profiler ve Skia frame ölçümü henüz yapılmadı. Bu belge çalışma zamanı ölçümü yapılmış gibi değerlendirilmemelidir.

## Çizgi bitişi render zinciri

1. `DrawingCanvas.endStroke` → `onChange({v:2,elements:[...content.elements,stroke]})`.
2. `CanvasPage.change` → `record(page.id,content)`, `setContent(next)`, `onHistory()`, `onDrawStart()`.
3. **Tarihsel gözlem:** Eski sürümde `onHistory` üst ekranda `setHistoryVersion` çağırıyordu. Güncel `NoteCanvasScreen.tsx` içinde `onHistory={()=>{}}` kullanıldığından bu render tetikleyicisi artık yok.
4. `onDrawStart` üst ekranda `setPanel(null)` çağırıyor (zaten null ise React bail-out yapabilir).
5. `CanvasPage` yeni `content` ile render olur; `Completed` içerik değiştiği için yeniden render olur; `content.elements.map` her çizgide tekrar yürütülür. `StrokeLayer` memo ve `cachedPath` mevcut çizgilerin geometri üretimini azaltır, ancak tüm çizim Skia scene graph içinde vektör olarak kalır.
6. `CanvasPage` içindeki `useEffect([content,error,saving])` → `onController(controller)` üst ekrandaki controller state'ini günceller; kaydetme durumunda da üst ekran tekrar render olabilir.
7. Aktif çizgi `draft` shared value olarak çizilir; `useLayoutEffect([content])` commit geldiğinde draft'ı temizler. UI-thread ve React commit sıralamasının atomik SkSurface devriyle garanti altına alındığı bir mekanizma yoktur.

## Hipotezlerin kaynak kod karşılığı

| Olası neden | Statik inceleme sonucu |
| --- | --- |
| Canvas key değişiyor | `CanvasPage key={selected.id}` sadece sayfa id değişince değişir; normal çizgi bitişinde değişmez |
| Elements tüm path'leri yeniden hesaplatıyor | `Completed` tüm listeyi yeniden gezer; `StrokeLayer` memo ve path cache aynı referanslı çizgileri korur |
| SkPicture baştan kaydediliyor | Mevcut çizim katmanında SkPicture / SkSurface yok |
| onLayout her stroke'ta fit resetliyor | `layout` yalnızca gerçek width/height farkında resetler; üst ekran layout değişirse risk var |
| Kaydedildi metni layout'u etkiliyor | Controller state üst ekranı yeniden render eder; gerçek layout etkisi cihazda ölçülmeli |
| Thumbnail snapshot çizgi bitişinde | İncelenen çizim akışında `makeImageSnapshot` çağrısı yok; repo genelinde arama gerekir |
| Sadeleştirme görseli değiştiriyor | Yeni centerline çizgilerde `makeStroke` ham noktaları yuvarlayarak saklıyor; eski v2 perfect-freehand render kullanıyor |
| Zustand aboneliği üst ekranı etkiliyor | `NoteCanvasScreen` notebook ve page store abonelikleri taşıyor; üst ekran ayrıca `onHistory` ve `onController` ile tetikleniyor |

## Silgi teşhisi

`DrawingCanvas.onUpdate` silgi için erken dönüyor; görsel maske veya bitmap temizleme yok. `pixelErase` yalnızca `onEnd` sonrası JS tarafında çağrılıyor. Nokta yoğunlaştırma adımı `max(0.8,r/3)` kullanıyor, dolayısıyla 1 sayfa biriminden daha seyrek örnekleme mümkün. Eski perfect-freehand stroke geometrisi ve centerline stroke geometrisi için aynı merkez-çizgi kesme yöntemi tam piksel eşleşmesi garantilemez.

## Sayfa teşhisi

**Tarihsel durum:** Eski sürümde dış sarmalayıcıda `marginHorizontal:12`, `marginTop:12`, telefonda `marginBottom:100`, gölge/elevation ve `borderRadius:6` bulunuyordu. 15 Kasım 2026 itibarıyla sayfa sarmalayıcısının margin ve borderRadius değerleri 0 olarak güncellendi; eski kenar/gölge teşhisi güncel sorun olarak yorumlanmamalı.

## Gerçek cihazda doğrulanacaklar

- React Profiler: `NoteCanvasScreen`, `CanvasPage`, `DrawingCanvas`, `Completed`, `StrokeLayer` render sayısı
- Stroke commit / draft temizleme zamanları ve ilk görünür kare
- 300/500+ elemanda FPS ve frame süresi
- Piksel silgi maskesi ile vektör sonuç arasındaki görsel fark
- Zoom sırasında yüzeyin yeniden rasterize edilme ve atomik takas süresi

## Hedef mimari

Kağıt şablonu sabit bir SkPicture; kalem ve vurgulayıcı için ayrı, sayfa/zoom bölgesi meta verili SkSurface önbellekleri; aktif stroke UI-thread; çizgi bitişinde aynı geometri ve paint ile yüzeye ekleme ve tek karede draft temizleme; silgi sırasında iki yüzeyde Clear; undo/redo ve zoom sonrası eski bitmap'i tutarak atomik yüzey takası. Bu mimari bu teşhis dokümanıyla **uygulanmış sayılmaz**.

## 15 Kasım 2026 — Lasso bırakma sıçraması (güncel sonuç)

Taşıma ve büyütme/küçültme sıçramaları önceki sürümde, React/Skia üzerinden güncellenen seçili geometri ile Reanimated shared transform'un farklı anlarda yenilenebilmesiyle ilişkiliydi. PR #42 ve #43 ile `DrawingCanvas.tsx` taşıma/ölçekleme yolu güncellendi: `frozenSelection` çizilen temel geometriyi korur; `committedDX/committedDY` ve `committedScale` bırakma worklet'inde biriktirilir; `commitSelectionMove`/`commitResize` kalıcı `PageContent` güncellemesini görüntüden ayrı yapar. Hit-test, birikmiş kaydırma ve ölçeği hesaba katar. Döndürme yolu mevcut `commitGesture`/handoff yapısını korur.

**Saha sonucu:** Kullanıcı Windows/Tauri'de önce taşımanın, ardından büyütme/küçültmenin düzeldiğini bildirdi. Bu, gerçek cihazda gözlenen sonuçtur; Skia kare düzeyinde ölçüm veya diğer platformlar için kapsamlı doğrulama değildir. Eski `setHistoryVersion`, sayfa gölgesi ve render zinciri hipotezleri tarihsel inceleme olarak saklanmıştır; güncel davranışı açıklamak için yukarıdaki kod akışını esas alın.

## 16 Kasım 2026 — PDF defteri beyaz ekranı: ayrıştırılmış nedenler

Bu bölüm, önceki çizim performansı teşhisinden ayrıdır. PDF içe aktarma sonrasında görülen beyaz ekranın tek bir nedeni yoktu:

1. **React açılış çökmesi (kullanıcı tarafından düzeldiği bildirildi):** `NoteCanvasScreen.tsx` içinde `[selectedId]` bağımlılık dizisine sahip `useEffect`, `selectedId` değişkeninin `useState` tanımından önce bulunuyordu. Bağımlılık dizisi render sırasında değerlendirildiğinden `Cannot access before initialization` hatası oluşuyordu. `f8b7eaf` effect'i tanımdan sonraya taşıdı. Kullanıcı açılışın düzeldiğini bildirdi.
2. **PDF sayfa arka planı henüz oluşturulmadı:** Tembel içe aktarmada ilk sayfa yalnız `pdfSource` / `pdfPageLayout` içerir; `backgroundImage` sonradan üretilir. `NoteCanvasScreen` hazırlanma durumunu gösterir, `pdfRenderQueue.web.ts` önceliklendirme yapar.
3. **Kaynak okuma/render hatası:** Tauri asset URL'si üzerinden pdf.js yüklemesi başarısız olabilir. Kodda dosya varlık kontrolü, baytlardan okuma alternatifi, zaman sınırları, iki tekrar denemesi ve hata gösterimi bulunur. Eksik JPEG `repairPdfBackground` üzerinden yeniden oluşturulabilir.
4. **Hydrate/render yarış riski:** `pageStore.hydrateAround` tam içeriği okurken `pdfRenderQueue.complete` arka planı SQLite'a yazabilir. Güncel kod ek SQLite okumaları ve küçük resim uzlaştırması içerir; bu düzen tüm eşzamanlılık senaryolarında kesin doğrulanmış değildir.

**Teşhis ayrımı:** Tam uygulama beyazsa önce JavaScript konsolundaki `Cannot access before initialization` gibi render hatalarını incele. Editör araçları görünür ama PDF kâğıdı boşsa `pdfSource`, `backgroundImage`, `getPdfPageError`, `failedJobs`, `[Notex PDF]` konsol kayıtları ve `page-assets` dosyalarını incele. Bunları aynı hata olarak sınıflandırma.

**Doğrulama:** `npm run typecheck`, ilgili Node testleri ve gerçek Windows/Tauri'de büyük PDF açma, hızlı sayfa geçişi, aynı anda çizim, kapatıp yeniden açma, eksik kaynak ve bozuk JPEG senaryoları ayrı yürütülmelidir. Bu belge yeni testlerin çalıştırıldığını iddia etmez. Önceki çizim performansı hipotezleri tarihsel statik analiz olarak korunmuştur.
