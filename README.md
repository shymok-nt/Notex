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
node --test features/cards/__tests__/cards.test.mjs
```

Gerçek kalem, silgi, sayfa geçişi ve yeniden açma akışlarını hedef platformda ayrıca test edin. Lasso seçiminde taşıma, art arda büyütme/küçültme, taşıma-sonrası-ölçekleme ve metin kutusu çift tıklama akışlarını da doğrulayın.

## Özellikler

- Defter oluşturma ve düzenleme; kapak, şablon, klasör, favoriler, sıralama, silinenler ve geri yükleme.
- Skia sayfa editöründe kalem, vurgulayıcı, şekil, metin, görsel, lasso seçim, taşıma, köşeden büyütme/küçültme, silgi, undo/redo, uzayan sayfa ve PDF arka planı.
- Defter başlığı araması, tema ve kalem ayarları.
- Ayarlardan açılan kart desteleri ve tekrar çalışma alanı.
- `.notex` dışa ve içe aktarma. Biçim 2 kartları ve çalışma geçmişini taşır; biçim 1 de okunur.

## Kod haritası

| Konum | Sorumluluk |
| --- | --- |
| `app/` | Expo Router ekranları ve sekmeler |
| `features/canvas/` | Çizim, vektör içerik ve kayıt kuyruğu |
| `features/cards/` | Kart zamanlayıcısı ve aktarım |
| `store/` | Zustand durumları |
| `db/` | SQLite bağlantısı, migrasyonlar ve repository'ler |
| `services/notexBackup.ts` | Yedekleme ve geri yükleme |
| `src-tauri/` | Masaüstü köprüsü |

Sayfa içeriği `PageContent v2` JSON olarak `pages.content` alanında saklanır. Düzenleme önce `usePageStore` durumuna yansır. `pagePersistence.ts` içindeki sayfa bazlı kuyruk 500 ms debounce uygular; sayfa geçişi bekleyen yazmayı tamamlar ve SQLite geri okumasıyla doğrular. Sayfa CRUD işlemleri repository transaction'ından sonra ortak store'a yansır.

`db/migrations.ts` içindeki güncel şema sürümü **4**'tür. Sürüm 1 temel tabloları, sürüm 2 defter dönüştürme ayarlarını, sürüm 3 kart tablolarını, sürüm 4 bazı kurulumlarda eksik kalan kart tablolarını idempotent olarak tamamlar. Eski migrasyonları yeniden yazmayın.

Ayrıntılı veri ve kayıt akışı için [NOTEX_DATA_ARCHITECTURE.md](./NOTEX_DATA_ARCHITECTURE.md), kod değişikliği kuralları için [AGENTS.md](./AGENTS.md) dosyasına bakın.

## Lasso taşıma ve ölçekleme (15 Kasım 2026)

`features/canvas/components/DrawingCanvas.tsx` içindeki seçili vektör/metin öğeleri, taşıma ve büyütme/küçültme sırasında **sabit `frozenSelection` geometrisi** üzerinden çizilir. Reanimated `committedDX/committedDY` ve `committedScale` değerleri gesture bırakılırken UI thread'de biriktirilir; `commitSelectionMove` ve `commitResize` güncel `moveBaselineRef` üzerinden sayfa içeriğini `onChange` ile kaydeder. Taşıma/ölçekleme kayıt onayı, seçili Skia geometrisini anında değiştirmez. Hit-test birikmiş kaydırma ve ölçeği hesaba katar. Bu yol, döndürme için mevcut `commitGesture`/handoff yolundan ayrıdır. `selectionHandoff.ts` yardımcılarını kaldırmayın.

- [PR #42 — taşıma sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/42)
- [PR #43 — büyütme/küçültme sıçraması düzeltmesi](https://github.com/shymok-nt/Notex/pull/43)

Kullanıcı Windows/Tauri üzerinde taşıma ve büyütme/küçültme sıçramalarının düzeldiğini bildirmiştir. Bu gözlem diğer platformlar veya bütün köşe durumları için otomatik test garantisi değildir.
