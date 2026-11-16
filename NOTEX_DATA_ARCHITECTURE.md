# Notex — Veri Mimarisi, Çizim ve Kalıcı Kayıt Rehberi

> **16 Kasım 2026 (`main` sonrası flashcard kaldırma):** Güncel SQLite şema sürümü **5**'tir. Sürüm 1–4 tarihsel migrasyonlar korunur; sürüm 5 flashcard tablolarını ve ilgili ayarları kaldırır. `.notex` biçim 1/2 yedekleri okunur, ancak eski kart verileri geri yüklenmez. `NoteCanvasScreen.tsx` içindeki `onHistory` boş callback'tir.

## İçindekiler

1. [Sistemin kısa özeti](#1-sistemin-kısa-özeti)
2. [Platformlar ve teknoloji](#2-platformlar-ve-teknoloji)
3. [Veri modeli ve SQLite şeması](#3-veri-modeli-ve-sqlite-şeması)
4. [Tek veri kaynağı: Zustand ve SQLite](#4-tek-veri-kaynağı-zustand-ve-sqlite)
5. [Çizimden kalıcı kayda veri akışı](#5-çizimden-kalıcı-kayda-veri-akışı)
6. [500 ms debounce ve kayıt kuyruğu](#6-500-ms-debounce-ve-kayıt-kuyruğu)
7. [Sayfa yükleme ve sayfa geçişi](#7-sayfa-yükleme-ve-sayfa-geçişi)
8. [Çizim, silgi, metin ve boş sayfa](#8-çizim-silgi-metin-ve-boş-sayfa)
9. [Sayfa CRUD ve veri bütünlüğü](#9-sayfa-crud-ve-veri-bütünlüğü)
10. [Eski taslakların tek seferlik kurtarılması](#10-eski-taslakların-tek-seferlik-kurtarılması)
11. [Hata yönetimi, sınırlar ve riskler](#11-hata-yönetimi-sınırlar-ve-riskler)
12. [Testler ve geliştirme komutları](#12-testler-ve-geliştirme-komutları)
13. [Yeni özellik ekleme kuralları](#13-yeni-özellik-ekleme-kuralları)
14. [Dosya haritası ve değişiklik geçmişi](#14-dosya-haritası-ve-değişiklik-geçmişi)

---

## 1. Sistemin kısa özeti

Notex; hesap, bulut hizmeti veya arka uç sunucusu gerektirmeyen, el yazısı odaklı bir not/defter uygulamasıdır. **Kalıcı sayfa verisinin tek ana kaynağı SQLite**, açık defterin ekranda kullanılan **tek ortak durum kaynağı Zustand `usePageStore`**'dur. Çizim için React Native Skia ve Gesture Handler kullanılır; Skia yüzeyi veri deposu **değildir**.

Editör her değişikliği ortak store'a aktarır; aynı işlem güncel sayfanın tam serileştirilmiş içeriğini, **sayfa kimliğine göre sıralı çalışan SQLite kayıt kuyruğuna** verir. Normal düzenlemede 500 ms sessizlikten sonra yazılır; sayfa değiştirmeden önce bekleyen değişiklikler `flush` ile tamamlanır ve yazılan değer SQLite'tan tekrar okunup doğrulanır.

**Bu bir “her tuşta SQLite'a yaz ve sonra ekranı güncelle” sistemi değildir.** Çizim akıcı kalsın diye önce bellek durumu güncellenir, kalıcı kayıt ertelenir. Kalıcılık için sıra/flush/doğrulama ve hata durumu korunur.

## 2. Platformlar ve teknoloji

| Katman | Kod / teknoloji | Sorumluluk |
| --- | --- | --- |
| Ekranlar | Expo Router; React Native / React | Defter, sayfa seçimi, araçlar |
| Ortak durum | Zustand `store/pageStore.ts` | Aktif defterin sayfaları ve güncel içerik |
| Canvas | `@shopify/react-native-skia`, Gesture Handler, Reanimated | Görsel çizim, gesture ve aktif çizim aktarımı |
| Kayıt kuyruğu | `features/canvas/store/pagePersistence.ts` | Debounce, seri yazma, flush, hata/başarı durumu |
| Repository | `db/repositories/pageRepository.ts` | SQLite CRUD, transaction, kayıt doğrulama |
| Veritabanı | `db/database.ts`, `db/migrations.ts` | Bağlantı, WAL, foreign keys, şema geçişleri |
| Windows | Tauri 2, `db/tauriDatabase.ts` | Rust/SQLite köprüsü üzerinden yerel kayıt |
| Android / iOS | Expo SQLite bağımlılıkları | Mevcut kodda bulunan platform altyapısı; güncel ürün hedefi değil |
| React Native Web | Expo Router / web altyapısı | Windows/Tauri arayüzünün temeli; bağımsız web ürün desteği varsayılmamalı |

Doğrulanan `package.json` bağımlılık örnekleri: Expo `~58.0.23`, React Native `0.88.1`, React `19.3.0`, Skia `2.14.0`, Reanimated `4.7.1`, Gesture Handler `~3.3.0`, Zustand `^5.0.8`, Expo SQLite `~58.0.15`, TypeScript `~6.0.3`. Sürüm yükseltmeden önce uyumluluk kontrolü yapılmalıdır.

## 3. Veri modeli ve SQLite şeması

### 3.1 Defter ve sayfa ilişkisi

Temel tablolar `db/migrations.ts` içinde oluşturulur:

| Tablo | Saklanan bilgi |
| --- | --- |
| `folders` | Klasör kimliği, başlık, konum |
| `notebooks` | Defter kimliği, başlık, kapak, varsayılan sayfa özellikleri, favori ve soft-delete |
| `pages` | Sayfa kimliği, bağlı defter, `position`, `template`, `paper_color`, `content`, önizleme yolu ve zamanlar |
| `settings` | Uygulama/araç tercihleri |

`pages.content`, **metin veya ekran görüntüsü değil, serileştirilmiş sayfa JSON verisidir**. `pageRepository`, `PageRow` ile uygulama `Page` tipi arasında dönüşüm yapar. `notebook_id` bir yabancı anahtardır; sayfa sırası `position` üzerinden tutulur.

### 3.2 Sayfa içerik formatı: `PageContent` v2

Kaynak: `features/canvas/types.ts` ve `features/canvas/engine/content.ts`.

```ts
type PageContent = {
  v: 2;
  elements: (StrokeElement | ShapeElement | TextElement)[];
  images?: PageImage[];
  backgroundImage?: PageImage;
  h?: number;
};
```

Örnek **boş, geçerli** sayfa:

```json
{"v":2,"elements":[]}
```

`parseContent("")` de boş sayfa üretir. Boş string `""` kaydedilmesi yasak değildir. Ancak normal v2 formatı `{"v":2,"elements":[]}` olduğundan boş diziyi “değişiklik yok” saymak **yanlıştır**.

- **Stroke:** `type:'stroke'`, `points:number[]` (x, y, basınç üçlüleri), `color`, `width`, `opacity`, `tool`, `bbox`, `z` ve kimlik. Vektördür.
- **Shape:** `type:'shape'`, geometri/parametre, çizgi/dolgu bilgileri.
- **Text:** `type:'text'`, `text:string`, konum, boyut, font, hizalama, `bbox`; `text:''` de geçerli ara değerdir.
- **Images/backgroundImage:** Bağımsız görsel varlıklarına URI/yol ve yerleşim referansları.
- **`h`:** Uzayan sayfa yüksekliği; mantıksal temel ölçüler `PAGE_WIDTH=1000`, `PAGE_HEIGHT=1414`.

Geçersiz/eskimiş nesnelerde `parseContent` güvenli bir boş görünüm üretebilir. **Boş görünen sayfa = veritabanındaki ham satırın boş olduğu kesin değil.** Veri kaybı araştırırken ham `content` alanını da incele.

### 3.3 Neden yeni `{id,title,content,strokes,...}` şemasına geçilmedi?

Mevcut ürün; **defter → sayfa** ilişkisi, şekil, metin, görsel, PDF arka planı ve `.notex` yedek biçimi kullanır. Yalnızca `strokes` alanına taşımak bu verileri düşürebilir. Çalışan revizyon bu nedenle `PageContent v2` ve mevcut SQLite şemasını **korur**. Yeni format gerekiyorsa ayrı, geriye uyumlu migrasyon, render ve yedek testi gereklidir.

## 4. Tek veri kaynağı: Zustand ve SQLite

```text
Gesture / metin / silgi / görsel
           │
           ▼
DrawingCanvas.onChange(PageContent)
           │
           ▼
useCanvasPageContent.change / commit
           │
           ▼
usePageStore.cacheContent(pageId, serialized)
       │                       │
       ▼                       ▼
Zustand pages[]          enqueuePageSave()
(anlık ekran)                   │
                               ▼
                      500 ms / flush
                               │
                               ▼
                     pageRepository.updateContent
                               │
                               ▼
                      SQLite read-back kontrolü
```

`usePageStore` yalnızca aktif defterin sayfalarını tutar; tüm defterlerin içeriklerini aynı anda belleğe alma iddiası yoktur. `CanvasPage` kendi bağımsız not listesi oluşturmaz. `useCanvasPageContent`, kaynağı `usePageStore` üzerinden seçer, `parseContent` ile `PageContent` nesnesine çevirir ve güncel içerik için `latest` ref'i kullanır.

**Sorumluluk sınırları:**

- `DrawingCanvas`: kullanıcı girişini yorumlar; **doğrudan SQLite veya localStorage yazmaz**.
- `useCanvasPageContent`: edit işlemlerini birleştirir; geçmiş (undo/redo) kaydını yönetir ve store'a iletir.
- `pageStore.cacheContent`: içerik farklıysa önce `enqueuePageSave`, ardından `pages` dizisindeki ilgili sayfayı günceller.
- `pagePersistence`: sayfa bazında hangi sürümün yazıldığını, beklediğini ve hata durumunu takip eder.
- `pageRepository`: gerçek SQL işlemlerini yapar.

`localStorage`, **aktif ikinci bir kalıcı kaynak değildir**. Önceki sürümlerden kalan taslaklara yalnızca tek seferlik kurtarma yolu ile bakılır (§10).

## 5. Çizimden kalıcı kayda veri akışı

1. Kalem, vurgulayıcı veya silgi hareketi `DrawingCanvas.tsx` tarafından alınır.
2. Aktif hareket Skia/Reanimated tarafında gösterilir. Hareketin sonunda `endStroke` ile vektör içerik hesaplanır.
3. `completeAndNotify`, JS tarafındaki `complete` işlemi bittikten sonra çizim durumunu serbest bırakır. Böylece kayıt için bekleyen geçiş, çizim işlenmeden tamamlanmış sanmaz.
4. `DrawingCanvas`, `onChange(nextContent)` ile sayfanın yeni vektör içeriğini bildirir.
5. `useCanvasPageContent.change`, gerekirse eski canvas props'larıyla güncel `latest` arasındaki farkı `reconcileById` kullanarak birleştirir.
6. Sonuç `usePageStore.cacheContent` ile yayımlanır ve aynı tam serileştirilmiş snapshot için kayıt kuyruğuna görev eklenir.
7. 500 ms boyunca yeni değişiklik gelmezse `pageRepository.updateContent` ile SQLite'a yazılır; `getStoredContent` ile **tam string eşitliği** doğrulanır.

### Eski çizginin silindikten sonra geri gelmesini engelleme

`features/canvas/engine/reconcilePageEdit.ts` içinde `reconcileById(base, incoming, latest)` vardır. Kimlikler üzerinden eklenen, düzenlenen ve silinen öğelerin farkını **en son commit edilmiş** öğelere uygular. Amaç: gecikmeli bir callback'in eski canvas props'larını kullanarak silinmiş stroke'u yeniden eklememesidir.

Bu mantığı değiştirirken **silgi, kalem, metin, şekil, görsel, undo ve arka arkaya gelen callback'leri** birlikte test et. `content.elements` dizisini eski prop ile doğrudan yazmak kaybolan ya da geri gelen not hatasını tekrar üretebilir.

## 6. 500 ms debounce ve kayıt kuyruğu

Kaynak: `features/canvas/store/pagePersistence.ts`.

Her sayfa kimliği için `Map<string, Entry>` kaydı tutulur:

| Alan | Anlamı |
| --- | --- |
| `latest` | Kaydedilmesi gereken son **serileştirilmiş** içerik |
| `version` | Sıraya alınan en güncel değişiklik sürümü |
| `savedVersion` | SQLite'a doğrulanarak yazılmış en son sürüm |
| `job` | Sayfanın devam eden kayıt Promise'i |
| `timer` | Debounce / retry zamanlayıcısı |
| `status` | `saved`, `saving` veya `error` |
| `listeners` | Kaydetme durumunu izleyen bileşenler |

Başlıca fonksiyonlar:

| API | Görev |
| --- | --- |
| `enqueuePageSave(pageId, serialized)` | Tam sayfa snapshot'ını kuyruğa ekler; **500 ms** sayaç başlatır/sıfırlar |
| `flushPageSave(pageId)` | Zamanlayıcıyı iptal eder, mevcut **ve yazılırken gelen yeni** sürümleri sırayla tamamlar |
| `finishPageSave(pageId)` | Sayfanın son kaydını bekler, ardından kayıt nesnesini temizler |
| `finishManyPageSaves(ids)` | Toplu işlem öncesi seçili sayfaların kaydını bitirir |
| `subscribePageSave`, `getPageSaveStatus` | `useSyncExternalStore` üzerinden küçük “Kaydediliyor / Hata” durumunu bildirir |
| `visibleSaveStatus` | Kayıt durumunu arayüzde kullanılacak biçime dönüştürür |

**Zamanlama:**

- `SAVE_DEBOUNCE_MS = 500`: Kullanıcı yazmaya devam ederken her tuş için ayrı SQLite işlemi yapılmaz.
- Hatalı otomatik kayıtta mevcut işaretlenmiş sürüm korunur ve kuyruk **5000 ms** sonra tekrar dener (`RETRY_MS`).
- `flush`, debounce süresini beklemez.
- Aynı sayfada eski SQLite yazması sürerken yeni düzenleme gelirse yeni snapshot sıraya alınır; son kayıt tamamlanmadan sayfa geçişi başarılı sayılmaz.
- `updateContent`, transaction içindeki `UPDATE` sorgusunun **tam bir sayfayı** güncellediğini kontrol eder. Ardından geri okunan `content`, yazılan snapshot'a eşit olmalıdır.

**Örnek API akışı (temsili):**

```ts
usePageStore.getState().cacheContent(pageId, serializeContent(next));
await flushPageSave(pageId); // sayfa değişimi / açık kayıt işlemi
```

`cacheContent` `false` döndürürse hedef sayfa bellekte bulunamamıştır; başarılı kayıt varsayma.

## 7. Sayfa yükleme ve sayfa geçişi

### 7.1 Açılış

- `app/_layout.tsx` uygulama başlangıcında `notebookStore.hydrate()` ve `settingsStore.hydrate()` çağırır. İlk uygulama başlatma yükleme ekranı buradadır.
- `app/note/[id].tsx`, `NoteCanvasScreen`'e yönlenir.
- Editör, `load(id)` çağrısını defter kimliği için yapar; yükleme efekti `[id, load]` bağımlılıklarına sahiptir. Sayfa kimliği/edit işlemleri için yeniden fetch yapılması amaçlanmaz.
- `usePageStore.load`, geçerli defter zaten yüklenmişse yeniden sorgulamaz. Başka deftere geçilirse SQLite `getByNotebook` çalışır.
- Yükleme `latestLoadRevision` ile geç kalan eski sonuçlara karşı kontrol edilir; yüklenen sayfalara gerektiğinde tek seferlik eski taslak kurtarması uygulanır.

### 7.2 Sayfa geçişi

`NoteCanvasScreen`'deki `select(pageId)`:

1. Önce `controllerRef.current?.flush()` bekler.
2. Canvas denetleyicisinin `flushPage` fonksiyonu açık metin editörünü bitirmeyi ister (`finishEditingRef.current?.()`) ve kayıt kuyruğunun tamamlanmasını bekler.
3. Aktif çizim varsa `useCanvasPageContent.flush` bunu bitirmek için bekler; sonsuza kadar beklemek yerine hata verebilir.
4. Hata alınırsa **sayfa değişimi durur** ve kullanıcıya uyarı gösterilir.
5. Hedef sayfa halen mevcutsa `setSelectedId` değiştirilir; sayfa ekleme/düzenleme sürecinde yeni `getByNotebook` çağrısı yapılmaz.

Seçilen sayfa değiştiğinde `<CanvasPage key={selected.id}>` farklı sayfanın canvas örneğini kurar. **Bu beklenen sayfa-bazlı mount davranışıdır; tüm uygulamanın yeniden yüklenmesi değildir.** Kendi içeriğinin kaynağı hâlâ ortak store'dur.

### 7.3 “Yükleniyor” kuralı

- Tam ekran yükleme başlangıçta veya **gerçek defter ilk kez yüklenirken** kullanılabilir.
- Metin, kalem, silgi, sayfa şablonu, sıra ve sayfa CRUD işlemlerinde `pages: []` ile listeyi boşaltıp editörü yeniden kurma.
- Kayıt göstergesi tam ekran overlay değil, küçük durum metni/eylemidir.
- `useEffect` bağımlılığına her değişimde yenilenen nesne/fonksiyon ekleyip `load` tekrarını tetikleme.

## 8. Çizim, silgi, metin ve boş sayfa

Lasso seçimi sonrasında küçük veya ince öğelerin taşınabilmesi için seçim merkezindeki dokunuş sürükleme olarak yorumlanır. Köşe tutamacı yalnızca merkezdeki sürükleme bölgesinin dışından yakalanır (`features/canvas/engine/selectionGestureTarget.ts`). Bu hit testi kayıt akışını değiştirmez; hareket sonucu yine `DrawingCanvas.onChange` üzerinden kaydedilir.

Metin öğeleri hâlâ `PageContent v2.elements` içindedir; ayrı bir `textBoxes` deposu yoktur. Metin aracı tıklamayla varsayılan boyutta, sürüklemeyle seçilen boyutta kutu açar. `TextElement` içindeki isteğe bağlı `italic` ve `underline` alanları eski kayıtların okunmasını etkilemez. Yazma sırasında metin 500 ms sonra ortak kayıt yoluna aktarılır; düzenleme bitişi ve sayfa geçişi bekleyen değişikliği tamamlar. Güncel silgi motoru metin öğelerini korur; metin silme seçme veya düzenleme eylemiyle yapılır. Masaüstünde `T` ve `L` ilgili araçlara geçer; lasso seçimi için Shift+tıklama ile seçime ekleme/çıkarma, Ctrl+A/C/X/V/D ve Delete/Backspace kısayolları bulunur.

### 8.1 Vektör çizim

`StrokeElement.points`, üçlü `[x,y,pressure]` verilerinin düzleştirilmiş dizisidir. Kalem bırakıldığında öğe `elements` listesine girer. Skia yalnızca bu vektör öğelerinin ve aktif çizim önizlemesinin çizimini yapar. Kaydedilecek değer **bitmap canvas görüntüsü değildir**.

### 8.2 Silgi

Silgi `DrawingCanvas.endStroke` içinde, `features/canvas/engine/pixelEraser.ts` dosyasındaki `pixelErase` algoritmasını kullanır:

- **Çizgi silgisi:** Etkilenen stroke/öğeyi kaldırabilir.
- **Piksel silgisi:** Vektör stroke'u değilen bölgeye göre parçalara ayırıp kalan parçalar için yeni vektör öğeleri üretir; yalnızca yüzeyde piksel temizleme işlemi değildir.
- Metin/şekiller için davranış öğenin türüne ve silgi moduna göre değişir; PDF arka planı bir stroke değildir.
- Sonuç `onChange` ile diğer tüm düzenlemelerle **aynı kayıt yoluna** girer; “silgi için kaydı atla” koşulu olmamalıdır.

### 8.3 Tamamını silme

Aşağıdakiler **geçerli son durumlar**dır:

```json
{"v":2,"elements":[]}
```

ve ham SQLite alanı için `""` değeri de korunabilir. Boş `elements` dizisi ile önceki çizim listesini **birleştirip geri getirme**. `if(content)`, `content || previous` gibi truthy fallback'ler ekleme. Alanın isteğe bağlı olup olmadığını kontrol etmek için örneğin `content !== undefined`, saklı kaydın yokluğunu ayırmak için `raw === null` kullan.

### 8.4 Undo/redo

`features/canvas/store/history.ts` sayfa kimliği başına `past`/`future` dizisi tutar (geçmişte en fazla 100 snapshot). Bu, **kalıcı depolama değil**, oturum içi düzenleme geçmişidir. Undo/redo ile üretilen içerik de ortak `commit` üzerinden SQLite kuyruğuna iletilir.

## 9. Sayfa CRUD ve veri bütünlüğü

Kaynak: `store/pageStore.ts` + `db/repositories/pageRepository.ts`.

| İşlem | Sıra / işlem |
| --- | --- |
| Sayfa ekleme | `pageRepository.add` transaction → yalnız yeni sayfayı `getByIds` ile oku → store'a ekle |
| Sayfa kaldırma | `finishPageSave` → SQLite `remove` → store'dan kaldır |
| Toplu silme | `finishManyPageSaves` → SQLite `removeMany` → store'dan kaldır; kaldırılan kayıtlar geri alma için döner |
| Sayfa sırası | SQLite `move` → store'daki listeyi yerinde yeniden sırala |
| Sayfa çoğaltma | Kaynak sayfaları `flushPageSave` → SQLite `duplicateMany` → yalnız yeni satırları oku |
| Geri yükleme | SQLite `restoreMany` → store'a ekle |
| Şablon/kâğıt rengi | SQLite `updateTemplate` → store'da ilgili sayfayı güncelle |
| İçerik ekleme/silme/düzenleme | Store ve `enqueuePageSave` → 500 ms sonra SQLite → geri okuma doğrulaması |

**Önemli nüans:** Sayfa CRUD, SQLite işleminden **sonra** state'e yansır; çizim/metin içeriği ise düşük gecikmeli **optimistic update** kullanır. Bu iki davranış farklıdır ve dokümantasyonda karıştırılmamalıdır.

`db/database.ts` yabancı anahtarları, WAL'i ve `PRAGMA user_version` migrasyonlarını yönetir. Tauri bağlantısı SQLite'ı Rust köprüsünden açar. Eski veritabanını `DROP TABLE`, `DELETE FROM pages` veya zorla yeniden başlatma ile “düzeltme”. Yeni alan gerekiyorsa yeni migrasyon ekle.

## 10. Eski taslakların tek seferlik kurtarılması

Önceki sürüm, Tauri `localStorage`'ında `notex:page-content:v1:<pageId>` anahtarları tutuyordu. Yeni sistem **bu anahtara normal yazma yapmaz**. `store/pageStore.ts` içindeki `migrateLegacyDrafts` yalnızca mevcut defter sayfaları yüklenirken kurtarma amacıyla çalışır:

1. Tauri değilse bu aşamayı atla.
2. Anahtar yoksa SQLite satırını olduğu gibi kullan.
3. `pending === true` ve `content/base` string ise eski taslağı kontrol et.
4. SQLite içeriği `base` veya zaten aynı `content` değerinde değilse **üzerine yazma**.
5. Kurtarma gerekiyorsa SQLite'a yaz ve geri okuyup doğrula.
6. Başarılı doğrulamadan sonra eski anahtarı kaldır.
7. Hata olursa satırı ve eski anahtarı korumaya çalış, konsola hata bildir.

**Bu bir ikinci senkronizasyon sistemi değildir.** Geçiş mantığını kaldırmadan önce eski kurulumların verisini ve güncelleme yolunu ayrıca test et.

## 11. Hata yönetimi, sınırlar ve riskler

### 11.1 Yazma hatası

`pagePersistence.flushPageSave`, SQLite işlemi veya geri okuma başarısızsa `status='error'` yapar ve Promise'i reddeder. Bekleyen değişiklik “kaydedildi” sayılmaz. Otomatik çalışmada 5 saniye sonra yeni deneme planlanır. `NoteCanvasScreen` açık kaydı `visibleSaveStatus` ile gösterir; yeniden dene eylemi vardır.

**Kayıt hatası varken sayfa geçişi** uyarı verir ve geçişi engeller. Çizim devam ederken `flush` çizim bitişini bekler; zaman aşımında hata verebilir.

### 11.2 Bilinen sınırlar

- **Bekleyen 500 ms'lik düzenleme:** Uygulamanın aniden kapanması/işlemin öldürülmesi halinde son değişiklik kaybolabilir; çünkü bu sürümde ikinci bir anlık disk günlüğü yoktur. Normal sayfa geçişi `flush` kullanır. “Her koşulda veri kaybı imkânsız” garantisi verme.
- **Unmount:** Canvas cleanup'ı `void flush()` başlatır; bu, uygulama sürecinin zorla sonlanmasına karşı bir garanti değildir.
- **Geri alma geçmişi:** `history.ts` bellektedir ve oturumlar arası kalıcı değildir.
- **Yedekleme:** `services/notexBackup.ts`, SQLite `pages.content` satırlarını okur. Kullanıcı aktif düzenleme sırasında yedek alırsa henüz flush edilmemiş snapshot yedeğe girmeyebilir; yedekleme akışına ayrıca açık flush eklemek gerekir.
- **Eski ham içerik:** SQLite v1 şema default'u tarihsel `v:1` JSON olabilir; `parseContent` güncel `v:2` biçimini bekler. Eski veriyi sessizce silme veya otomatik boş v2 ile üzerine yazma.
- **Büyük sayfalar:** Çok büyük `elements` dizilerinde JSON serileştirme, çizim render'ı ve SQLite güncelleme maliyeti ölçülmelidir.
- **Web/Android/iOS:** Windows/Tauri'de kullanıcı tarafından doğrulanan davranış, diğer platformların otomatik onayı değildir.

### 11.3 Sık görülen sorunlarda ilk bakılacak yerler

| Belirti | Önce kontrol et |
| --- | --- |
| Silinen çizim geri geliyor | `reconcilePageEdit.ts`, `useCanvasPageContent.change`, `pixelErase.ts`, `DrawingCanvas.onChange` |
| Sayfa değişince son çizgi kayboluyor | `completeAndNotify`, `useCanvasPageContent.flush`, `pagePersistence.flushPageSave` |
| Kayıt işareti sürekli “saving” | `version/savedVersion`, `job`, SQLite `updateContent/getStoredContent` |
| Silme yalnız ekranda | `pageStore.remove/removeMany` ve repository transaction |
| Bütün editör yükleniyor | `NoteCanvasScreen` yükleme `useEffect` bağımlılıkları, `pageStore.load` |
| Boş sayfadan eski yazı geliyor | `emptyContent`, `parseContent`, `cacheContent`, SQLite ham `content` |

## 12. Testler ve geliştirme komutları

### 12.1 Standart komutlar

```bash
npm ci
npm run typecheck
node --test features/canvas/engine/__tests__/*.test.mjs
npm run tauri:dev
```

Diğer komutlar:

```bash
npm start
npm run web
npm run android
npm run ios
npm run check
npm run tauri:export
npm run tauri:build
```

`tauri:build` kurulum paketi üretir; sıradan kod doğrulaması için gerekli değildir. `npm run check` Expo paket uyumluluğunu da kontrol eder; TypeScript kontrolünden farklıdır.

### 12.2 Otomatik test kapsamı

- `features/canvas/engine/__tests__/pagePersistence.test.mjs`: boş sayfa / `""` kayıtları, 500 ms debounce, devam eden kayıt sırasında yeni düzenleme, SQLite hata/yeniden deneme, silinen stroke'u eski callback'le geri getirmeme.
- `features/canvas/engine/__tests__/pageStorePersistence.test.mjs`: sayfa ekle → içerik yaz → tekrar aç, bütün içeriği boşalt → tekrar aç, sayfa sil → yeniden yükle, düzenleme/silmede listenin yeniden fetch edilmemesi.
- `features/canvas/engine/__tests__/` altındaki diğer testler: stroke kesintisi, silgi handoff, seçim, geometriler, metin kutusu ve benzeri motor davranışları.
- `.github/workflows/notex-persistence-checks.yml`: PR'da `npm ci`, `npm run typecheck`, motorun Node testleri. Geçen PR #12 çalışması bu kontrolleri doğrulamıştır; bu, gerçek GUI otomasyonu yerine geçmez.

### 12.3 Tauri manuel regresyon listesi

- [ ] Defter aç → çizim yap → hızlı sayfa değiştir → geri dön: çizim duruyor.
- [ ] Bütün yazıyı sil → sayfa değiştir → geri dön: boş kalıyor.
- [ ] Çizginin bir kısmını piksel silgisiyle sil → geri dön: kesim korunuyor.
- [ ] Çizgiyi çizgi silgisiyle tamamen sil → geri dön: geri gelmiyor.
- [ ] Metni düzenle ve tamamen boşalt → sayfa değiştir → geri dön.
- [ ] Sayfa ekle/sil/taşı/çoğalt → uygulamayı yeniden aç: sonuçlar aynı.
- [ ] Undo/redo → sayfa değiştir → geri dön: son commit edilen durum korunuyor.
- [ ] İşlem sırasında editörün tamamı “Yükleniyor” ekranına dönmüyor.
- [ ] SQLite yazma hatasını simüle et → hata gösteriliyor, başarı sanılmıyor.
- [ ] Büyük sayfa, görsel, PDF sayfası ve `.notex` yedeğinde regresyon yok.
- [ ] Android ve web platformlarında aynı akış ayrıca çalışıyor.

**Doğrulama durumu (2026-11-14):** GitHub Actions üzerinde PR #12 için TypeScript ve Node motor testleri geçti; kullanıcı Tauri'de asıl silme/kaybolma probleminin düzeldiğini bildirdi. Yukarıdaki tüm manuel senaryoların ayrı ayrı koşulup geçtiğine dair kayıt yoktur.

## 13. Yeni özellik ekleme kuralları

1. İşten önce `AGENTS.md`, bu belge ve hedef kodu oku; dosya yollarını tahmin etme.
2. **Tek kaynak:** Canvas için yeni `useState<PageContent>`, paralel not store'u veya ikinci `localStorage` veri kaynağı kurma.
3. Sayfa içerik değişikliğini `useCanvasPageContent` → `usePageStore.cacheContent` üzerinden geçir; doğrudan SQL veya Skia render state'inden yazma.
4. Kalem/silgi gesture'larında ağır SQLite/JSON işini UI thread'e koyma. Aktif çizginin geçici görselleştirilmesi ile tamamlanmış öğe listesini karıştırma.
5. Her düzenleme türü (kalem, silgi, metin, görsel, seçim, undo/redo) için boş liste ve tam silme senaryoları yaz.
6. `content || old` gibi truthy fallback'ler kullanma; `''`, `[]`, `0` geçerli içerik olabilir. Nullable alanları açıkça ayır.
7. Sayfa geçişinde `flush` bariyerini kaldırma; kaydetme hatasını yutup başarılı geçiş gibi gösterme.
8. Sayfa CRUD için önce repository transaction, sonra ortak store güncellemesi yaklaşımını koru; tam listeyi her işlemde yeniden sorgulama.
9. Eski SQLite migrasyonlarını yeniden yazma; yeni şema için **yeni sürümlü migrasyon** ve `.notex` içe/dışa aktarma uyumluluğu testi hazırla.
10. Eski taslak kurtarma kodunu “gereksiz” diye silmeden önce geriye dönük yükseltme testi yap.
11. `npm run typecheck`, ilgili Node testleri ve mümkünse gerçek Tauri/Android testlerini çalıştır. Başarısız/çalıştırılamayan testi açıkça bildir.
12. Yeni özellik kayıt, silgi, çizim formatı veya platform davranışını değiştirirse **bu rehberi de aynı PR'da güncelle**.

## 14. Dosya haritası ve değişiklik geçmişi

### 14.1 Güncel temel dosyalar

```text
app/_layout.tsx
app/note/[id].tsx
features/canvas/
  components/
    NoteCanvasScreen.tsx
    DrawingCanvas.tsx
    CanvasPageStrip.tsx
  hooks/
    useCanvasPageContent.ts
  store/
    pagePersistence.ts
    history.ts
  engine/
    content.ts
    reconcilePageEdit.ts
    pixelEraser.ts
    strokeInterruption.ts
    eraserHandoff.ts
    __tests__/
      pagePersistence.test.mjs
      pageStorePersistence.test.mjs
  types.ts
store/
  pageStore.ts
  notebookStore.ts
db/
  database.ts
  tauriDatabase.ts
  migrations.ts
  repositories/
    pageRepository.ts
    notebookRepository.ts
services/
  notexBackup.ts
src-tauri/
.github/workflows/notex-persistence-checks.yml
```

### 14.2 Önceki sistemden kaldırılanlar

PR #12 ile şu eski veya mükerrer kayıt yolu dosyaları kaldırıldı:

- `features/canvas/hooks/useAutosave.ts`
- `features/canvas/store/pageContentStorage.ts`
- `features/canvas/engine/autosavePolicy.ts` ve ona özgü test
- `store/notesStore.ts` ve `store/useNotesStore.ts`
- Kullanılmayan eski `screens/NoteScreen.tsx`, `screens/NotesListScreen.tsx` ve bunlara bağlı `NoteActions`, `CreateNoteSheet`, `NoteGrid`, `NoteCard`, `NotePreview` bileşenleri

**Bunları referans gösteren eski bir belgeyi esas alarak sistemi yeniden kurma.**

### 14.3 Referans PR'lar

- [PR #12 — Tek SQLite kayıt mimarisi](https://github.com/shymok-nt/Notex/pull/12)
- [PR #42 — Lasso taşıma sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/42)
- [PR #43 — Lasso ölçekleme sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/43)
- [Notex GitHub Actions](https://github.com/shymok-nt/Notex/actions)

---

**Belge bakım politikası:** Bu rehber **çalışan kodun güncel mimarisini** belgelemek içindir. Veri yapısı, kaydetme kuyruğu, silgi, sayfa yükleme, SQLite migrasyonları, yedek veya platform davranışı değişirse belge güncellenmelidir. Kod ile rehber çeliştiğinde önce güncel kod doğrulanır, ardından rehber düzeltilir.

## 15. Güncel Lasso seçim mimarisi (15 Kasım 2026)

`DrawingCanvas.tsx` içinde `selectionKey` ile ilişkili `frozenSelection`, seçilen stroke/shape/text öğelerinin Skia üzerinde çizilen temel geometrisini tutar. Taşıma sırasında `dragX/dragY` canlı hareketi gösterir; bırakma worklet'inde delta `committedDX/committedDY` içine aktarılır. Köşe büyütme/küçültmesinde `gestureScale` bırakılırken `committedScale` içine çarpılarak biriktirilir; pinch ölçeklemesi ayrıca konum deltası biriktirebilir. Böylece çizilen geometri ile shared transform kayıt onayında iki farklı karede yeniden kurulmaz.

`commitSelectionMove` ve `commitResize`, güncel `moveBaselineRef` içeriğini dönüştürür ve `onChange` ile ortak `useCanvasPageContent` → `pagePersistence` → SQLite yoluna gönderir. `moveFrozenRef`, hareket/ölçekleme commit'leri boyunca eski Skia temel geometrisinin korunmasını sağlar; `movePendingRef` kayıt edilen öğeleri izler. Seçim tutamacı hit-test'i birikmiş öteleme ve ölçeği dikkate alır. Döndürme ve diğer dönüşümler için mevcut `commitGesture`, `handoff` ve `selectionHandoff.ts` yardımcıları kullanılmaya devam eder.

**Regresyon kontrolü:** art arda taşıma, art arda ölçekleme, taşıma→ölçekleme, ölçekleme→taşıma, metin kutusu çift tıklama, undo/redo ve seçim/araç değiştirme. Kullanıcı Windows'ta taşıma ve ölçekleme sıçramalarının düzeldiğini doğruladı; tüm bu kombinasyonların otomatik uçtan uca test edildiği iddia edilmez.

## 16. Tembel PDF içe aktarma, SQLite uzlaştırma ve hata onarımı (16 Kasım 2026)

### 16.1 Kaynak dosya ve sayfa modeli

`utils/pdfImport.web.ts:preparePdfImport` Windows/Tauri'de PDF seçimini açar ve `utils/tauriFiles.ts:storePdfSource` ile orijinal dosyayı uygulama verisindeki `pdf-sources/` dizinine kopyalar. pdf.js sayfaların boyutlarını okur. İlk SQLite kaydında sayfa içeriği `PageContent v2` olup `elements:[]`, `images:[]`, `pdfSource:{file,pageIndex}`, `pdfPageLayout` ve `h` taşır; `backgroundImage` ve `thumbnailPath` başlangıçta bulunmayabilir. Sayfalar JPEG tamamlanmadan defter olarak açılır. Eski raster PDF/PNG sayfalarının `backgroundImage` alanı tek başına geçerlidir; onlara zorla `pdfSource` eklenmez.

### 16.2 Arka plan oluşturma

`utils/pdfRenderQueue.web.ts` içindeki `resumePdfNotebook`, SQLite'dan PDF kaynaklı sayfaları tarar; arka planı olmayanları `jobs` haritasına koyar. `prioritizePdfPage`, seçili sayfayı öne alır ve çevresindeki sayfalara yakınlık önceliği verir. `pump` en fazla iki eşzamanlı iş çalıştırır. `getDocument`, kaynak dosyanın varlığını kontrol eder, pdf.js URL erişimi başarısızsa veya 15 saniyeyi aşarsa `readStoredFile` üzerinden baytlardan yüklemeyi dener. `renderPdfPage` JPEG arka planı ve küçük resmi `page-assets/` dizinine yazar. Render için 30 saniyelik iptal ve iki tekrar denemesi uygulanır. `failedJobs`, hata mesajı ve yeniden deneme durumunu tutar; `releasePdfNotebook` belge önbelleğini kapatır.

### 16.3 İçerik hidratasyonu ve eşzamanlılık

`db/repositories/pageRepository.ts:getByNotebook` hafif sayfa satırlarını getirir. `store/pageStore.ts:hydrateAround` seçili sayfanın yaklaşık üç önce/üç sonraki komşusunu `getByIds` ile yükler. Eski taslak kurtarma işleminden sonra SQLite'yı yeniden okur; mağazaya yazarken daha yeni `thumbnailPath` değerini korur ve bir kez daha SQLite'dan arka plan bilgisini uzlaştırır. Bu yol, render ile hydrate'in yarışını azaltmak içindir.

`pdfRenderQueue.complete`, önce `flushPageSave(pageId)` yapar; ardından SQLite transaction içinde mevcut `pages.content` içeriğini okuyup yalnızca aynı `pdfSource` ve `pdfPageLayout` bulunan, arka planı eksik sayfaya `backgroundImage` ve `thumbnail_path` ekler. Aktif mağaza sayfası `contentLoaded:false` ise küçük resim güncellenir; tam içerik hydrate ile gelir. Yüklenmiş sayfada arka plan mevcut çizimlerin üzerine eklenir. `DrawingCanvas` düzenleme sırasında `pdfSource` ve diğer içerik alanlarını korur.

**Dikkat:** Bu mekanizma sayfa bazında tam bir mutex değildir. SQLite commit, mağaza uzlaştırması ve kullanıcı çiziminin bütün olası iç içe geçişleri için otomatik stres testi doğrulaması bulunmuyor. Mimariyi kesinlikle yarışsız diye belgeleme; yeni değişikliklerde eşzamanlı render + çizim + hydrate regresyonu uygula.

### 16.4 Görünür durumlar ve onarım

`NoteCanvasScreen.tsx` PDF arka planı eksik olduğunda `Sayfa hazırlanıyor…` ve ilerleme durumu gösterir; yükleme/render hatasında gerçek hata ve `Tekrar dene` sunar. `hydrateAround` hata verirse bir kez daha denenir. `DrawingCanvas.tsx` PDF arka plan görselinin okunamamasını normal eklenmiş görsel hatasından ayırır. `repairPdfBackground` eksik/bozuk arka planı SQLite içeriğinden temizleyerek sayfayı tekrar render kuyruğuna alır; çizim elemanlarını silmek için tasarlanmamıştır.

**Açılış çökmesi düzeltmesi:** `NoteCanvasScreen.tsx` içinde `selectedId` bir effect'in bağımlılık dizisinde, `useState` tanımından önce okunuyordu. `f8b7eaf` commit'i effect'i tanımdan sonraya taşıdı; kullanıcı sorunun düzeldiğini bildirdi.

### 16.5 Yedekleme, silme ve doğrulama

`services/notexBackup.ts`, `.notex` biçim 2 arşivinde `pdfSource.file` referansını ve kaynak PDF dosyasını diğer sayfa varlıklarıyla birlikte taşır; geri yüklemede yollar yeniden eşlenmelidir. `notebookRepository` silme akışları PDF kaynak dosyalarını da hesaba katar. Önceden içe aktarılmış `backgroundImage` sayfalarının açılabilirliği korunmalıdır. Veritabanı şema sürümü hâlâ **4**; PDF tembel yükleme için yeni tablo/migrasyon eklenmemiştir.

**Henüz kanıtlanmayanlar:** 200 sayfalık PDF'de uçtan uca süre/FPS, zaman aşımı ve iptalde kaynakların tamamının temizlenmesi, bozuk PDF'nin otomatik toparlanması, render/çizim eşzamanlılık stres testi, eski PNG yedekleri ve PDF kaynaklı `.notex` geri yüklemenin gerçek Windows/Tauri doğrulaması. Kod incelemesi, bu testlerin geçmiş olduğu anlamına gelmez.

## Flashcard kaldırma geçişi (şema 5)

Uygulamanın Kartlar sekmesi, kart çalışma sayfası, nottan karta dönüştürme eylemi, kart repository/store ve zamanlayıcı modülü kaldırıldı. Eski şema 3 ve 4 migrasyonları SQLite `user_version` geçişlerinin geriye uyumluluğu için dosyada kalır; **yeni kurulumlar dahil** şema 5 geçişi kart tablolarını, kart tetikleyicilerini ve kart ayarlarını siler. Bu işlem eski kart/çalışma geçmişini kalıcı olarak siler; defterler, sayfalar, görseller ve PDF kaynakları korunur. Yedek biçim numarası 2 olarak kaldı: eski biçim 2 arşivlerindeki kart alanları yok sayılır.
