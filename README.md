# KampüsKit Backend

Bağımsız Node.js/TypeScript API reposu. Supabase Auth, RLS ile veri erişimi, özel dosyalar, Google Places, staj kaynakları ve yoğunluk ML çıkarımı burada çalışır. Frontend reposunu veya üst dizindeki npm workspace'i okumaz.

## Kurulum

Node.js 24 önerilir (en az 22.17). Bu reponun kökünde:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Windows: `Copy-Item .env.example .env.local`. API http://127.0.0.1:3001 adresinde açılır. `APP_ORIGIN` frontend'in tam origin adresi olmalıdır; varsayılan http://127.0.0.1:5173.

```dotenv
PORT=3001
HOST=127.0.0.1
APP_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_PLACES_API_KEY=
SPOONACULAR_API_KEY=
```

Supabase kurulmadan sağlık ve ML demo uçları kullanılabilir. Gerçek hesap/veri için [kurulum rehberindeki](docs/SETUP.md) migration ve Auth ayarlarını tamamla. Normal kullanıcı erişimi kullanıcı JWT'siyle RLS kurallarını korur; service-role yalnızca import/yönetimde kullanılır.

## Klasörler

```text
src/app.ts               API yönlendirme, Origin/CSRF ve hatalar
src/server.ts            Yalnızca API sunan Node adaptörü
src/worker.ts            Bağımsız Cloudflare Worker adaptörü
src/config/              Runtime ortam ayarları
src/http/                Gövde, çerez ve hata yardımcıları
src/integrations/        Supabase ve kaynak adaptörleri
src/modules/             Auth, data, storage, internships, places, occupancy
packages/shared/         Sürümlenmiş yerel tip/kural paketi
supabase/                Migrationlar ve katalog
scripts/                 Yönetim ve veri hazırlama
ml/                      İsteğe bağlı Python eğitimi ve raporlar
tests/                   API, RLS, adaptör ve model regresyonları
docs/                    Kurulum, API, entegrasyon ve ML belgeleri
dist/index.js            Üretilmiş Worker API
```

`@kampuskit/shared`, `file:./packages/shared` bağımlılığıdır; başka repo checkout'u veya registry gerektirmez. API sözleşmesi değişikliklerinde frontend reposunun aynı sürümle güncellenmesini sağla. Yerel paketle birlikte `package-lock.json` sürümlenir.

## Kontroller ve çalıştırma

```bash
npm test
npm run lint
npm run build
npm start
```

Derleme yalnızca bu reponun `dist/index.js` Worker çıktısını üretir. Node üretim servisi için kaynak kod, `npm ci`, Node.js 24 ve runtime ortam ayarlarıyla `npm start` kullan. Frontend statik dosyaları bu Node servisinde sunulmaz. Worker isteğe bağlı platform ASSETS binding'ini destekler; binding olmadan API dışındaki yollar 404 döner.

Üretimde `NODE_ENV=production`, `APP_ORIGIN=https://FRONTEND_DOMAIN` ve uygun HOST/PORT ayarlanır. HTTPS reverse proxy, frontend origin'indeki `/api/` ve `/api/auth/callback` yollarını bu servise aktarmalıdır. Sırlar frontend build'ine veya Git'e eklenmez.

ML çalışma zamanı Python gerektirmez. Yeniden eğitim [ml/README.md](ml/README.md), veri/model atıfları [ml/DATA_LICENSE.md](ml/DATA_LICENSE.md), uçlar [docs/API.md](docs/API.md) içinde açıklanır. GitHub Actions bu reponun test/lint/build kontrollerini bağımsız çalıştırır.

## Render

[render.yaml](render.yaml) ücretsiz Frankfurt Node servisini tanımlar. Build komutu `npm ci --include=dev && npm run build`, başlangıç `npm start`. Render'ın verdiği `PORT` kullanılır; `HOST=0.0.0.0`, `NODE_ENV=production` ve `APP_ORIGIN=https://frontend-ll4u.onrender.com` ayarlanır. `/api/health` servisin durumunu bildirir.

Render Environment bölümünde `SUPABASE_URL` ve `SUPABASE_PUBLISHABLE_KEY` ayarlanmalıdır. Sırlar Git'e yazılmaz. Supabase Auth Site URL: `https://frontend-ll4u.onrender.com`; izin verilen dönüş adresi: `https://frontend-ll4u.onrender.com/api/auth/callback`. Migration ve diğer anahtarlar için [kurulum](docs/SETUP.md) rehberini kullan. Bu değerler olmadan demo ve ML çalışır; hesap ve kişisel veri hizmetleri etkinleşmez.
