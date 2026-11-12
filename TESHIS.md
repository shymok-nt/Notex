# Notex çizim ekranı — kaynak kod teşhisi

> İnceleme: kaynak kod üzerinden statik teşhis. Gerçek cihaz React Profiler ve Skia frame ölçümü henüz yapılmadı. Bu belge çalışma zamanı ölçümü yapılmış gibi değerlendirilmemelidir.

## Çizgi bitişi render zinciri

1. `DrawingCanvas.endStroke` → `onChange({v:2,elements:[...content.elements,stroke]})`.
2. `CanvasPage.change` → `record(page.id,content)`, `setContent(next)`, `onHistory()`, `onDrawStart()`.
3. `onHistory` üst `NoteCanvasScreen` içinde `setHistoryVersion` çağırıyor: üst ekran tekrar render olur.
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

Dış sarmalayıcıda `marginHorizontal:12`, `marginTop:12`, telefonda `marginBottom:100`, `shadowOpacity`, `shadowRadius`, `elevation`, `borderRadius:6` var. `DrawingCanvas` fitWidth hesabında da 4px pay bulunuyor.

## Gerçek cihazda doğrulanacaklar

- React Profiler: `NoteCanvasScreen`, `CanvasPage`, `DrawingCanvas`, `Completed`, `StrokeLayer` render sayısı
- Stroke commit / draft temizleme zamanları ve ilk görünür kare
- 300/500+ elemanda FPS ve frame süresi
- Piksel silgi maskesi ile vektör sonuç arasındaki görsel fark
- Zoom sırasında yüzeyin yeniden rasterize edilme ve atomik takas süresi

## Hedef mimari

Kağıt şablonu sabit bir SkPicture; kalem ve vurgulayıcı için ayrı, sayfa/zoom bölgesi meta verili SkSurface önbellekleri; aktif stroke UI-thread; çizgi bitişinde aynı geometri ve paint ile yüzeye ekleme ve tek karede draft temizleme; silgi sırasında iki yüzeyde Clear; undo/redo ve zoom sonrası eski bitmap'i tutarak atomik yüzey takası. Bu mimari bu teşhis dokümanıyla **uygulanmış sayılmaz**.
