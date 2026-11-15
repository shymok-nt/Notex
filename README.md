# Notex

Notex, yerel çalışan, el yazısı odaklı bir defter uygulamasıdır. React Native, Expo Router ve TypeScript kullanır. Windows masaüstünde Tauri, Android/iOS'ta Expo SQLite, web'de tarayıcı SQLite bağlantısı kullanılır. Hesap veya bulut arka uç zorunlu değildir.

## Başlatma ve doğrulama

```bash
npm ci
npm start
npm run web
npm run android
npm run ios
npm run tauri:dev
```

`npm run tauri:build` Windows paketi üretir. Değişikliklerden sonra kapsamına göre:

```bash
npm run typecheck
node --test features/canvas/engine/__tests__/*.test.mjs
node --test features/cards/__tests__/cards.test.mjs
```

Gerçek kalem, silgi, sayfa geçişi ve yeniden açma akışlarını hedef platformda ayrıca test edin.

## Özellikler

- Defter oluşturma ve düzenleme; kapak, şablon, klasör, favoriler, sıralama, silinenler ve geri yükleme.
- Skia sayfa editöründe kalem, vurgulayıcı, şekil, metin, görsel, seçim, silgi, undo/redo, uzayan sayfa ve PDF arka planı.
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
