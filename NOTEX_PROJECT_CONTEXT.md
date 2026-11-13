# NOTEX — PROJECT CONTEXT & AGENT HANDOFF

> **Amaç:** Bu belge, Notex projesini devralan AI coding agent'ların mevcut mimariyi anlaması, veri kaybına yol açmadan geliştirme yapması ve önceki kararları koruması için hazırlanmıştır.
>
> **İnceleme tarihi:** 14 Kasım 2026  
> **Kaynak:** https://github.com/shymok-nt/Notex  
> **Branch:** `main`  
> **Yerel proje dizini:** `C:\Notex`  
> **Belge durumu:** GitHub'dan incelenen dosyalar ve önceki geliştirme raporları temel alınmıştır. Tüm kaynak dosyalar satır satır denetlenmemiştir.

---

## 1. Proje Tanımı

**Notex**, el yazısı ve dijital not alma odaklı, yerel çalışan bir not defteri uygulamasıdır.

Ürünün hedefi, Goodnotes, Notability ve OneNote gibi uygulamalara modern, kullanışlı ve erişilebilir bir alternatif oluşturmaktır.

### Temel ürün ilkeleri

- Hesap oluşturma zorunluluğu bulunmamalıdır.
- Kullanıcı notları varsayılan olarak cihazında saklanmalıdır.
- İnternet bağlantısı olmadan temel not alma özellikleri çalışmalıdır.
- Kalem ve dokunmatik giriş desteklenmelidir.
- Notlar otomatik kaydedilmelidir.
- Kullanıcı verileri uygulama güncellemelerinde korunmalıdır.
- Arayüz modern, sade ve profesyonel olmalıdır.
- Büyük ve karmaşık defterlerde performans korunmalıdır.

### Platformlar

| Platform | Teknoloji | Durum |
|---|---|---|
| Windows | Tauri 2 + Expo Web | Geliştiriliyor |
| Android | React Native + Expo | Kod tabanında mevcut |
| Web | React Native Web | Tauri arayüzünün temeli |
| iOS | Expo yapılandırması | Gerçek cihaz desteği doğrulanmalı |

**Önemli:** Bir platformda çalışan özellik, diğer platformda otomatik olarak çalışıyor kabul edilmemelidir.

---

## 2. Teknoloji Yığını

GitHub `package.json` dosyasından doğrulanan başlıca bağımlılıklar:

| Teknoloji | Sürüm | Görev |
|---|---|---|
| Expo | ~58.0.23 | Uygulama altyapısı |
| React Native | 0.88.1 | Mobil arayüz |
| React | 19.3.0 | Bileşen sistemi |
| TypeScript | ~6.0.3 | Tip güvenliği |
| Expo Router | ~58.0.30 | Navigasyon |
| React Native Skia | 2.14.0 | Canvas çizimi |
| Zustand | ^5.0.8 | Uygulama state yönetimi |
| Expo SQLite | ~58.0.15 | Yerel veritabanı |
| Reanimated | 4.7.1 | Animasyonlar |
| Gesture Handler | ~3.3.0 | Dokunma ve hareketler |
| React Native Web | ^0.21.0 | Web arayüzü |
| Tauri API | ^2.12.4 | Masaüstü entegrasyonu |
| PDF.js | 5.4.624 | PDF okuma ve render |
| JSZip | ^3.10.1 | Arşiv işlemleri |
| Perfect Freehand | ^1.2.2 | Çizgi geometrisi |

Tauri'nin Rust tarafındaki sürüm ve bağımlılıkları için ayrıca `src-tauri/Cargo.toml` incelenmelidir.

### Mimari yaklaşım

Notex tek bir React Native/Expo kod tabanını kullanır. Windows sürümünde bu arayüz web olarak dışa aktarılır ve Tauri penceresinde çalıştırılır.

Bu nedenle:

- Mobil ve masaüstü kodu mümkün olduğunca paylaşılmalıdır.
- Platforma özel işlemler ayrı adaptörlerde tutulmalıdır.
- Native dosya sistemi ve veritabanı işlemleri platforma göre ayrılmalıdır.
- Windows için yapılan değişiklikler Android davranışını bozmamalıdır.

---

## 3. Proje Dizinleri

GitHub'da doğrulanan ve geliştirme sürecinde kullanılan temel yapılar:

```text
Notex/
├── app/
│   ├── (tabs)/
│   ├── _layout.tsx
│   ├── backup.tsx
│   ├── canvas-lab.tsx
│   └── ...
├── components/
├── features/
│   └── canvas/
│       ├── components/
│       ├── engine/
│       └── types.ts
├── db/
│   ├── database.ts
│   ├── migrations.ts
│   └── repositories/
├── store/
├── services/
├── theme/
├── types/
├── utils/
├── scripts/
├── src-tauri/
│   └── tauri.conf.json
├── android/
├── public/
├── assets/
├── package.json
├── README.md
└── AGENTS.md
```

### Önemli dosyalar

| Dosya | Sorumluluk |
|---|---|
| `features/canvas/types.ts` | Canvas elemanları ve sayfa içerik tipleri |
| `features/canvas/components/DrawingCanvas.tsx` | Ana çizim ve metin render sistemi |
| `features/canvas/components/NoteCanvasScreen.tsx` | Defter düzenleme ekranı |
| `db/database.ts` | Veritabanı bağlantısı ve transaction yardımcıları |
| `db/migrations.ts` | SQLite şema sürümleri |
| `db/repositories/pageRepository.ts` | Sayfa CRUD, sıralama ve içerik kaydı |
| `utils/pdfImport.web.ts` | Windows PDF içe aktarma |
| `utils/tauriFiles.ts` | Tauri dosya işlemleri |
| `services/notexBackup.ts` | Yedekleme ve geri yükleme |
| `src-tauri/tauri.conf.json` | Windows uygulama yapılandırması |
| `scripts/prepare-pdfjs-assets.mjs` | PDF.js çalışma dosyalarını hazırlama |

**Agent talimatı:** Dosya yollarını bu belgeden körü körüne kullanma. İşlem yapmadan önce mevcut dosyanın gerçekten bulunduğunu ve güncel içeriğini doğrula.

---

## 4. Çizim Motoru

Notex'in en kritik bileşeni Skia tabanlı çizim sistemidir.

### Sayfa koordinatları

`features/canvas/types.ts`:

```ts
export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 1414;
```

Bu değerler mantıksal sayfa koordinatlarını tanımlar.

Sayfaların yüksekliği, `PageContent.h` üzerinden genişletilebilir.

### Desteklenen elemanlar

`Element` birleşimi:

```ts
type Element =
  | StrokeElement
  | ShapeElement
  | TextElement;
```

Görseller ayrı `PageImage` modeliyle saklanır.

### StrokeElement

Başlıca alanları:

- `id`
- `type: 'stroke'`
- `renderMode`
- `z`
- `createdAt`
- `tool`
- `color`
- `width`
- `opacity`
- `points`
- `bbox`

Kalem türleri `pen` ve `highlighter` olarak tanımlanmıştır.

### ShapeElement

Desteklenen şekil türleri:

- line
- arrow
- rect
- ellipse
- triangle
- polygon

Şekiller konum, boyut, dönüş, çizgi ve dolgu bilgilerini taşır.

### TextElement

Metin elemanları şunları içerir:

- Konum: `x`, `y`
- Genişlik: `w`
- İçerik: `text`
- Yazı boyutu: `fontSize`
- Renk: `color`
- Kalınlık: `bold`
- Hizalama: `align`
- Yazı ailesi: `fontFamily`
- Minimum yükseklik: `minHeight`
- Silme bilgisi: `erasures`
- Sınırlar: `bbox`

Eski el yazısı tanıma verileri için `recognitionSourceStrokes` ve `recognitionManuallyEdited` alanları korunmuştur.

### Kritik çizim kuralları

1. Aktif çizgi ile kalıcı çizgi arasındaki geçiş bozulmamalıdır.
2. Çizim sırasında gereksiz React state güncellemeleri yapılmamalıdır.
3. Ağır veritabanı veya dosya işlemleri çizim anında çalıştırılmamalıdır.
4. Undo/redo geçmişi korunmalıdır.
5. Çizgi geometrisi, silgi ve Lasso işlemleri birlikte test edilmelidir.
6. Eski çizgi formatları yeni renderer tarafından okunabilmelidir.
7. Skia path önbellekleme ve performans optimizasyonları gerekçesiz değiştirilmemelidir.

**Özellikle korunacak davranış:** Aktif çizginin kalıcı çizgiye aktarılması sırasında görsel boşluk veya çift çizim oluşmamalıdır. Önceki geliştirme sürecinde bu geçiş için gecikmeli temizleme kullanılmıştır; güncel uygulama ayrıntıları koddan doğrulanmalıdır.

---

## 5. Sayfa İçerik Formatı

Mevcut tip tanımı:

```ts
type PageContent = {
  v: 2;
  elements: Element[];
  images?: PageImage[];
  backgroundImage?: PageImage;
  h?: number;
  beautifications?: Beautification[];
};
```

Boş sayfa:

```ts
{
  v: 2,
  elements: []
}
```

### Alanların anlamı

| Alan | Açıklama |
|---|---|
| `v` | İçerik format sürümü |
| `elements` | Kalem, şekil ve metin |
| `images` | Sayfaya eklenen görseller |
| `backgroundImage` | PDF gibi arka plan görselleri |
| `h` | Mantıksal sayfa yüksekliği |
| `beautifications` | El yazısı güzelleştirme verileri |

### Geriye uyumluluk

- Eski kayıtlarda bulunmayan opsiyonel alanlar hata oluşturmamalıdır.
- Bilinmeyen içerik türleri uygulamayı çökertmemelidir.
- Eski veriler kaydedilirken gereksiz yere silinmemelidir.
- Veri formatı değişiyorsa eski kayıtlar için dönüşüm stratejisi hazırlanmalıdır.
- `.notex` yedekleriyle uyumluluk kontrol edilmelidir.

---

## 6. Metin Kutusu Sistemi

Metin sistemi, geçmişte en fazla hata yaşanan alanlardan biridir.

### Beklenen kullanıcı davranışı

- Sayfaya metin kutusu eklenebilmelidir.
- Yazı yazıldıkça içerik görünür kalmalıdır.
- Enter ile yeni satır oluşturulmalıdır.
- Metin kutusu gerektiğinde büyüyebilmelidir.
- Kullanıcı metin kutusunu taşıyabilmelidir.
- Boyutlandırma sırasında metin kaybolmamalıdır.
- Düzenleme tamamlandığında Skia görünümü korunmalıdır.

### Önceki sorunlar

- Metin kutusunun kontrolsüz büyümesi.
- Yazarken üst satırların görünmez olması.
- `textarea` iç kaydırmasının beklenmedik davranması.
- Düzenleme ve Skia render genişliklerinin farklı görünmesi.
- Kaydedilen metnin dar bir sütunda görüntülenmesi.
- Boyutlandırma tutamacının yalnızca yatay çalışması.

### Teknik bulgu

Windows web arayüzünde gerçek HTML `textarea` kullanılır.

Önceki bir düzeltmede yüksekliğin görünmez bir `Text` bileşeni yerine textarea içeriğinin ölçümüne göre hesaplanması hedeflenmiştir.

Metin kutusunun davranışını değiştirirken şu değerler birlikte kontrol edilmelidir:

- `textarea.scrollHeight`
- `textarea.clientHeight`
- `textarea.scrollTop`
- Parent container yüksekliği
- Canvas scale ve zoom
- `TextElement.w`
- Skia `Paragraph.layout()` genişliği

**Uyarı:** Metin kutusunun son boyutlandırma davranışının bütün senaryolarda sorunsuz olduğu doğrulanmış değildir.

---

## 7. Görsel Sistemi

Görseller `PageImage` modeliyle temsil edilir.

```ts
type PageImage = {
  id: string;
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
```

### Temel beklentiler

- Kullanıcı görsel seçebilmeli.
- Görsel canvas üzerinde görünmeli.
- Görsel kalıcı olarak saklanmalı.
- Uygulama yeniden açıldığında yüklenmeli.
- Konum ve boyut bilgileri korunmalı.
- Yedekleme ve geri yüklemede görsel dosyaları kaybolmamalı.

Önceki geliştirme sırasında Windows'ta görsel seçilip görünmemesi sorunu yaşanmış, daha sonra düzeltildiği bildirilmiştir.

Bu alan tekrar değiştirilirse Windows'taki native dosya yolu, Tauri asset URL dönüşümü ve Skia görsel yükleme davranışı birlikte incelenmelidir.

---

## 8. PDF İçe Aktarma Sistemi

PDF içe aktarma sistemi Windows/Tauri için geliştirilmiştir.

**Doğrulanan dosya:** `utils/pdfImport.web.ts`

### Kullanılan teknoloji

PDF.js:

```text
pdfjs-dist 5.4.624
```

### Mevcut işlem akışı

1. Kullanıcı Tauri dosya seçim penceresinden PDF seçer.
2. Dosya native yolundan okunur.
3. PDF.js ile belge açılır.
4. PDF sayfaları sırayla render edilir.
5. Her sayfa PNG görsele dönüştürülür.
6. Küçük sayfa önizlemesi oluşturulur.
7. Dosyalar `page-assets/` alanına yazılır.
8. Sayfa içerikleri hazırlanır.
9. Sayfa kayıtları SQLite'a eklenir.
10. Sonraki açılışlarda saklanan sayfa görselleri kullanılabilir.

### PDF sayfa görüntüsü

Kodda tanımlı sınırlar:

```ts
const PAGE_RENDER_MAX_EDGE = 1600;
const PAGE_THUMBNAIL_WIDTH = 96;
```

Render ölçeği:

```ts
Math.min(
  1.6,
  PAGE_RENDER_MAX_EDGE /
    Math.max(
      baseViewport.width,
      baseViewport.height
    )
)
```

Bu yaklaşım, aşırı büyük bitmap üretimini sınırlamayı amaçlar.

### PDF saklama modeli

PDF sayfaları düzenlenebilir PDF nesneleri olarak değil, PNG arka planları olarak saklanır.

Her sayfanın içeriğinde şu alan kullanılır:

```ts
backgroundImage
```

Böylece PDF üzerine çizim ve metin gibi Notex içerikleri eklenebilir.

### PDF'nin önemli sınırlamaları

- Orijinal PDF metin katmanı korunmaz.
- PDF içindeki metin doğrudan seçilebilir metin değildir.
- PDF sayfaları raster görüntü olarak saklanır.
- Çok sayfalı PDF'lerde dönüştürme süresi ve depolama maliyeti artabilir.
- Mevcut kod sayfaları sırayla işler; tam anlamıyla ihtiyaç oldukça render eden bir sistem değildir.
- Şifreli PDF'ler için hata mesajı bulunmaktadır.

### Hata yönetimi

`preparePdfImport()` işlem sırasında oluşturulan dosya yollarını takip eder.

Hata durumunda hazırlanmış varlıkların temizlenmesi amaçlanır.

Sayfa kayıtları için `pageRepository.appendImportedPages()` transaction kullanır.

### PDF geliştirme kuralları

- Daha önce içe aktarılmış PDF her açılışta yeniden dönüştürülmemelidir.
- PDF kaynak dosyası silinse bile kayıtlı sayfalar çalışmalıdır.
- PDF sayfa sırası korunmalıdır.
- Yatay ve dikey PDF'ler doğru görüntülenmelidir.
- Büyük PDF'lerde arayüzün donması önlenmelidir.
- PDF arka planları yedekleme sistemine dahil edilmelidir.
- Başarısız aktarmalar eksik defter veya sahipsiz dosya bırakmamalıdır.

### Gelecek iyileştirmeler

- PDF içe aktarma hızını artırma.
- Çok büyük belgelerde bellek kullanımını azaltma.
- İptal edilebilir içe aktarma.
- Sayfa bazlı ilerleme ve hata raporu.
- PDF üzerine yazılmış notları yeni PDF olarak dışa aktarma.
- PDF sayfalarını yeniden sıralama ve kaldırma.

---

## 9. SQLite ve Veri Kalıcılığı

Notex yerel SQLite kullanır.

### Temel dosyalar

```text
db/database.ts
db/migrations.ts
db/repositories/
```

### Veri katmanının görevleri

- Defter oluşturma ve güncelleme.
- Sayfa ekleme ve silme.
- Sayfa sıralama.
- Canvas içeriğini kaydetme.
- Kullanıcı tercihlerini saklama.
- Dosya referanslarını yönetme.

### Doğrulanan sayfa işlemleri

`pageRepository.ts` içinde:

```text
getByNotebook()
getRecentAcrossNotebooks()
add()
appendImportedPages()
remove()
move()
duplicateMany()
removeMany()
restoreMany()
updateContent()
updateTemplate()
```

### Transaction kullanımı

Veritabanında birden fazla kaydı etkileyen işlemler `withSafeTransaction()` üzerinden yürütülmektedir.

Özellikle:

- Sayfa sıralama.
- PDF sayfalarını ekleme.
- Çoklu sayfa silme.
- İçerik güncelleme.

### Migrasyon kuralları

1. Mevcut migrasyonları değiştirme.
2. Şema değişikliği gerekiyorsa yeni sürüm ekle.
3. Eski kullanıcı verilerini koru.
4. Uygulama açılışında otomatik veri silme yapma.
5. Şema değişikliğini eski veritabanı kopyasında test et.
6. Başarısız migrasyonda veri bütünlüğünü koru.

**Kesinlikle yasak:** Hata çözmek için kullanıcı veritabanını sıfırlamak.

---

## 10. Yedekleme ve Geri Yükleme

Notex'in yedek formatı:

```text
.notex
```

İlgili servis:

```text
services/notexBackup.ts
```

### Yedekleme hedefi

Bir yedek, defterin yeniden oluşturulması için gereken tüm verileri kapsamalıdır:

- Defter bilgileri.
- Sayfalar.
- Çizimler.
- Metinler.
- Şekiller.
- Görseller.
- PDF arka planları.
- Gerekli dosya varlıkları.

### Geri yükleme ilkeleri

- Eski yedekler mümkün olduğunca açılabilmelidir.
- Eksik dosyalar açık hata mesajıyla bildirilmelidir.
- Aynı kimlikli kayıtlar dikkatle ele alınmalıdır.
- Başarısız geri yükleme mevcut verileri bozmamalıdır.
- Yedek sürümü ve içerik şeması doğrulanmalıdır.

**Önemli:** Yeni bir içerik türü eklenirse yalnızca canvas renderer değil, yedekleme ve geri yükleme kodu da güncellenmelidir.

---

## 11. Windows / Tauri Mimarisi

Tauri yapılandırması:

```text
src-tauri/tauri.conf.json
```

### Doğrulanan uygulama bilgileri

```text
productName: Notex
version: 1.0.0
identifier: com.notex.desktop
```

### Pencere

```text
Varsayılan: 1280 × 800
Minimum: 900 × 620
Yeniden boyutlandırılabilir: Evet
```

### Frontend

```text
frontendDist: ../dist
devUrl: http://127.0.0.1:1431
```

### Build

```text
beforeDevCommand:
npm run tauri:export && npm run tauri:serve

beforeBuildCommand:
npm run tauri:export
```

### Windows kurulum paketi

Tauri yapılandırmasında NSIS hedefi bulunur.

```json
"targets": ["nsis"]
```

WebView için offline installer seçeneği kullanılmaktadır.

### Asset erişimi

Tauri asset protocol kapsamında:

```text
$APPDATA/covers/**
$APPDATA/images/**
$APPDATA/page-assets/**
$APPDATA/thumbnails/**
```

Bu dizinler kullanıcıya ait kalıcı dosyalar içerebilir.

**Kural:** Build, uninstall veya geliştirme işlemleri sırasında bu veriler rastgele silinmemelidir.

---

## 12. Geliştirme Komutları

### İlk kurulum

```bash
npm install
```

### Expo geliştirme

```bash
npm start
```

### Android

```bash
npm run android
```

### Web

```bash
npm run web
```

### TypeScript kontrolü

```bash
npm run typecheck
```

### Expo bağımlılık kontrolü

```bash
npm run check
```

### Skia web kurulumu

```bash
npm run setup:skia-web
```

### PDF.js dosyaları

```bash
npm run setup:pdfjs
```

### Tauri frontend export

```bash
npm run tauri:export
```

### Windows geliştirme

```bash
npm run tauri:dev
```

### Windows production build

```bash
npm run tauri:build
```

**Not:** `package.json` içinde ayrı bir `npm test` script'i görünmüyor. Testleri çalıştırmadan önce repodaki gerçek test dosyaları ve test runner belirlenmelidir.

### Önerilen kontrol sırası

```bash
npm run typecheck
npm run check
npm run tauri:export
```

Production build yalnızca gerektiğinde çalıştırılmalıdır.

---

## 13. Git ve Sürüm Yönetimi

### GitHub

```text
https://github.com/shymok-nt/Notex.git
```

### Ana branch

```text
main
```

### Güvenli çalışma ilkeleri

- İşlem öncesi `git status` kontrol edilmeli.
- Kullanıcının yerel değişiklikleri korunmalı.
- Gereksiz dosyalar commit'e eklenmemeli.
- `.env` ve gizli anahtarlar Git'e gönderilmemeli.
- Kullanıcı veritabanları commit'e eklenmemeli.
- `node_modules`, build çıktıları ve installer dosyaları yanlışlıkla push edilmemeli.
- Force push yapılmamalı.
- Kullanıcı istemedikçe commit/push yapılmamalı.

### Önemli ayrım

**GitHub'a kaynak kod kaydetmek** ve **Windows EXE üretmek** ayrı işlemlerdir.

EXE dosyasını GitHub'a göndermek zorunlu değildir.

---

## 14. Tamamlanan ve Doğrulama Gerektiren Alanlar

| Özellik | Kaynak durumu | Ek doğrulama |
|---|---|---|
| Defter kütüphanesi | Kod tabanında mevcut | Kullanıcı testi |
| SQLite kalıcılık | Kodda mevcut | Veri kaybı testleri |
| Skia çizim | Kodda mevcut | Performans testi |
| Kalem ve silgi | Geliştirilmiş | Platform testleri |
| Metin kutuları | Kodda mevcut | Boyutlandırma testi |
| Görsel ekleme | Düzeltildiği bildirildi | Windows/Android testi |
| PDF içe aktarma | Kodda mevcut | Büyük PDF testi |
| PDF arka plan saklama | Kodda mevcut | Yeniden açma testi |
| `.notex` yedekleme | Servis mevcut | Round-trip testi |
| Windows NSIS | Yapılandırılmış | Temiz kurulum testi |
| Android | Proje mevcut | Release testi |

**Durum tanımları:** Kodda bulunması, özelliğin tüm cihazlarda hatasız çalıştığı anlamına gelmez.

---

## 15. Bilinen Teknik Riskler

### 15.1 Metin kutusu boyutlandırma

Önceki geliştirme raporlarına göre tüm yönlerde büyütme/küçültme davranışı beklendiği gibi çalışmayabilir.

Kontrol edilmesi gerekenler:

- Pointer hareketleri.
- Canvas zoom.
- Genişlik ve yükseklik sınırları.
- Metin satır kaydırma.
- Skia render sonucu.

### 15.2 PDF performansı

Çok sayfalı belgelerde her sayfanın PNG'ye dönüştürülmesi CPU, RAM ve disk kullanımı oluşturabilir.

Özellikle 100+ sayfalı PDF'ler test edilmelidir.

### 15.3 Büyük canvas içerikleri

Çok sayıda çizgi, şekil ve görsel içeren sayfalarda:

- FPS.
- Bellek kullanımı.
- Sayfa açılış süresi.
- Undo/redo maliyeti.
- SQLite yazma gecikmesi.

ölçülmelidir.

### 15.4 Platform uyumluluğu

Tauri'ye özgü dosya API'leri Android'de kullanılmamalıdır.

Platform ayrımı test edilmelidir.

### 15.5 Yedekleme güvenilirliği

PDF ve görsel varlıkları içeren büyük yedekler için bozuk arşiv, eksik dosya ve kısmi geri yükleme senaryoları test edilmelidir.

---

## 16. Ürün Yol Haritası

Bu bölüm doğrulanmış tamamlanmış özellikler değil, **önerilen geliştirme öncelikleridir**.

### Öncelik 1 — Güvenilirlik

- Metin kutusu etkileşimlerini kararlı hâle getirme.
- PDF içe aktarma performansını iyileştirme.
- Büyük defterlerde performans testleri.
- Otomatik kayıt ve geri yükleme testleri.
- Veri kaybı senaryolarını engelleme.

### Öncelik 2 — Temel PDF iş akışı

- PDF üzerine not alma deneyimini geliştirme.
- PDF sayfa navigasyonu.
- PDF sayfalarını düzenleme.
- İşaretlenmiş PDF dışa aktarma.
- Büyük PDF dosyalarında hızlı açılış.

### Öncelik 3 — Profesyonel not alma

- Gelişmiş Lasso.
- Nesne taşıma ve boyutlandırma.
- Gelişmiş metin biçimlendirme.
- Görsel kırpma ve döndürme.
- Kalem hazır ayarları.
- Sayfa şablonları.

### Öncelik 4 — Yayın hazırlığı

- Uygulama kimliği ve sürümleme.
- Windows installer testleri.
- Android release testleri.
- Gizlilik politikası.
- Lisans ve bağımlılık kontrolü.
- Hata raporlama.
- Kullanıcı dokümantasyonu.
- Performans ve erişilebilirlik iyileştirmeleri.

---

## 17. Yeni Coding Agent İçin Kesin Kurallar

### Kural 1 — Önce incele

Her görevde ilgili mevcut kaynak kodunu oku.

Dosya, fonksiyon veya mimariyi tahmin etme.

### Kural 2 — Çalışanı bozma

İstenmeyen refactor yapma.

Bir özelliği düzeltirken diğer sistemlerin davranışını değiştirme.

### Kural 3 — Veri kaybına yol açma

SQLite dosyalarını, kullanıcı görsellerini veya yedeklerini silme.

Veritabanı değişikliklerinde geriye uyumlu migrasyon kullan.

### Kural 4 — Çizim performansını koru

Çizim sırasında ağır işlem yapma.

Aktif çizgi ve kalıcı çizgi geçişine dikkat et.

### Kural 5 — Platformları ayır

Windows/Tauri için yapılan geliştirme Android'i bozmamalı.

### Kural 6 — Testleri çalıştır

En azından ilgili TypeScript ve mevcut test kontrollerini çalıştır.

Çalıştırılamayan testleri açıkça bildir.

### Kural 7 — GUI otomasyonu kullanma

Kullanıcının bilgisayarında otomatik fare ve klavye kontrolü yapma.

Gerekli manuel test adımlarını kullanıcıya bildir.

### Kural 8 — İzinsiz Git işlemi yapma

Kullanıcı istemedikçe commit, push, branch oluşturma veya merge yapma.

### Kural 9 — İzinsiz EXE oluşturma

Production installer build işlemini yalnızca istendiğinde yap.

### Kural 10 — Sonucu açık raporla

Her görev sonunda:

- Değiştirilen dosyaları belirt.
- Yapılan işlemleri özetle.
- Test sonuçlarını bildir.
- Manuel doğrulama gereken noktaları belirt.
- Eksik kalanları gizleme.

---

## 18. Yeni Agent'ın İlk Yapacağı İşlemler

Yeni agent, kod değiştirmeden önce:

1. Bu belgeyi tamamen okumalı.
2. `AGENTS.md` dosyasını okumalı.
3. `package.json` dosyasını incelemeli.
4. `src-tauri/tauri.conf.json` dosyasını kontrol etmeli.
5. İlgili özellik klasörlerini incelemeli.
6. `db/database.ts` ve `db/migrations.ts` dosyalarını anlamalı.
7. `features/canvas/types.ts` veri modelini okumalı.
8. Git çalışma ağacının durumunu kontrol etmeli.
9. Kullanıcıdan gelen görevin kapsamını belirlemeli.
10. Yalnızca gerekli değişiklikleri uygulamalı.

**Yeni agent, belgedeki bilgilerle mevcut kod çelişirse güncel kaynak kodunu esas almalı ve belgeyi güncelleme ihtiyacını raporlamalıdır.**

---

## 19. Agent Devir Mesajı

Yeni bir AI coding agent'a aşağıdaki mesajı ver:

> Notex projesini devralıyorsun.
>
> Önce `NOTEX_PROJECT_CONTEXT.md` ve `AGENTS.md` dosyalarını tamamen oku. Ardından mevcut kaynak kodunu incele.
>
> Proje React Native, Expo, Skia, SQLite ve Tauri 2 kullanıyor. Kullanıcı verilerini, çizim motorunu, otomatik kayıt sistemini ve platform uyumluluğunu korumalısın.
>
> Önceki özellikleri yeniden yazma veya gereksiz refactor yapma. Her görevde yalnızca istenen kapsamda çalış.
>
> Kullanıcı açıkça istemedikçe Git commit/push, EXE build veya GUI otomasyonu yapma.
>
> Kod tabanını tanıdıktan sonra yeni görevimi bekle.

---

## 20. Belge Bakım Politikası

Bu belge yaşayan bir proje rehberidir.

Aşağıdaki durumlarda güncellenmelidir:

- Yeni büyük özellik tamamlandığında.
- Teknoloji sürümleri değiştiğinde.
- Veritabanı şeması değiştiğinde.
- Yeni platform desteği eklendiğinde.
- Önemli mimari karar alındığında.
- Kritik bir hata ve kök nedeni kesin olarak belirlendiğinde.
- Yayın sürümü oluşturulduğunda.

**Temel ilke:** Notex'in gelişimi sırasında bilgi kaybı yaşanmamalı; yeni agent geçmiş kararları ve sistemin kritik noktalarını anlayabilmelidir.

---

**NOTEX — END OF PROJECT CONTEXT**
