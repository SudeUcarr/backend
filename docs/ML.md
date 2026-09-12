# Yoğunluk ML entegrasyonu

Yoğunluk ekranında **Öğrenci bildirimleri** ve **Yoğunluk tahmini · ML** sekmeleri bulunur. ML görünümü hesapsız demoda `/#/demo/yogunluk?gorunum=ml`, oturumlu uygulamada `/#/app/yogunluk?gorunum=ml` adresindedir. Ana panelde de bu görünümün bağlantısı vardır. Model sonuçları öğrenci bildirim tablosuna yazılmaz.

## Çalışma akışı

Frontend yoğunluk ekranı ve HTTP istemcisi → `/api/occupancy/*` → `src/modules/occupancy/`.

İki önceden eğitilmiş Random Forest, backend'de TypeScript ile değerlendirilir. Biri seçilen andaki, diğeri tam 60 dakika sonraki kişi sayısını tahmin eder. Python çalışma zamanında gerekli değildir. Model ağırlıkları ve ham giriş geçmişleri frontend statik dosyalarına eklenmez. API yalnızca test örneklerini, raporları, kaynaklı kapasiteleri ve hesaplanan tahmini döndürür. Ortak tipler ve kapasite/sınav senaryosu kuralları `packages/shared/src/occupancy.ts` içindedir.

Girdiler: saat, haftanın günü, son 15/30/60/120/240 dakikanın girişleri ve gün içi toplam giriş. Gelecek girişler ile mevcut/gelecek sensör sayımı girdi değildir. Pencereler sol sınırı dışlar, seçilen anı kapsar. Aynı saniyede birden çok giriş korunur. Kaynak zamanları yerel duvar saati olarak işlenir; tarayıcı saat dilimi kayıt saatini değiştirmez. Ağaç eşiklerine karşılaştırmadan önce girdiler sklearn gibi float32'ye dönüştürülür.

Test gününü ve saati seçme, deneme girişi ekleme, geçmiş grafiğini açma, şehir/mekân türü filtreleme, bağımsız manuel mevcut/gelecek senaryoları ve kütüphane sınav haftası varsayımı kullanılabilir. Ağ hataları yeniden denenebilir; seçim değişince eski istek iptal edilir ve eski sonuç gösterilmez. +60 dakika için tarihsel kapsama yoksa sonuç `null` kalır.

## Kaynak ve sınırlar

Kaynak, **COD: A Dataset of Commercial Building Occupancy Traces (2017)** içindeki Bosch Office 1 ana giriş sensörünün sayısal kayıtlarıdır. Bu bir öğrenci kartı veya canlı kampüs verisi değildir. Pozitif sensör değişimleri giriş olaylarına dönüştürülmüştür. Seçilmiş üniversitelerin resmî kapasiteleri senaryolar içindir; kullanıcının seçtiği üniversiteye otomatik olarak atfedilmez. Üniversite belgeleri yeniden yayımlanmaz.

108 eğitim, 36 doğrulama ve 37 test günü kronolojik olarak ayrılmıştır. Mevcut an için 2.103, bir saat sonrası için 1.955 test kaydı vardır. Kaynak raporundaki MAE sırasıyla yaklaşık 3,08 ve 3,79 kişidir; bu sayılar kampüs doğruluğunu göstermez. Kütüphane, yemekhane veya spor salonunda gerçek kullanım için yerel veriyle eğitim ve doğrulama gerekir. Sınav haftası artışı öğrenilmiş etki değildir; yalnızca kütüphaneye uygulanan açık bir varsayımdır.

COD türev verileri ve model dışa aktarımları CC BY-SA 4.0 bildirimiyle korunur. Bildirim [ml/DATA_LICENSE.md](../ml/DATA_LICENSE.md) dosyasında ve uygulamadaki lisans bağlantısında bulunur. Entegrasyon kaynak `kampuskit-ml` klasörünü değiştirmeden seçilmiş kod, modeller ve eğitim araçlarını bu depoya almıştır; sanal ortam, ham arşiv ve bağımsız demo uygulaması taşınmamıştır.

## Geliştirme ve doğrulama

```bash
npm run dev
npm test
npm run build
```

Backend testleri tüm mevcut ve gelecek Python referans tahminlerini karşılaştırır; zaman sızıntısı, eksik gelecek etiketleri, simülasyon, API doğrulaması ve model verisinin istemciye sızmaması kontrol edilir. Senaryo eşikleri ve sınav kuralları frontend testlerinde kontrol edilir. Eğitim yenileme adımları [ml/README.md](../ml/README.md) içindedir.
