# KampüsKit yoğunluk modellerini yeniden eğitme

Bu klasör orijinal `kampuskit-ml` eğitim araçlarını içerir. Web uygulaması önceden dışa aktarılmış JSON modellerini **backend'de TypeScript ile** çalıştırır; siteyi başlatmak için Python veya yeniden eğitim gerekmez. Ekranlar ve API akışı [docs/ML.md](../docs/ML.md) belgesindedir.

## İsteğe bağlı eğitim

Python 3.12 ortamı önerilir. Depo kökünden:

```bash
python -m venv ml/.venv
# Windows: ml\.venv\Scripts\activate
# Linux/macOS: source ml/.venv/bin/activate
python -m pip install -r ml/requirements-lock.txt
python ml/download_cod.py
python ml/train.py
python ml/train_forecast.py
python -m unittest discover -s ml -p test_forecast.py
npm test
npm run build
```

`download_cod.py` sürümlü Zenodo COD arşivini indirir ve yayıncı checksum'unu doğrular. `train.py`, `ml/data/raw/COD.zip` dosyasını kullanır. Önce mevcut an modelini eğit; `train_forecast.py` onun hazırladığı CSV, rapor ve joblib modelini kullanır. Eğitim çıktıları `ml/artifacts/` altında, çalışma zamanı JSON çıktıları `src/modules/occupancy/assets/` altında üretilir. Ham veri, CSV, joblib ve sanal ortam Git tarafından yok sayılır. Rapor JSON'ları ve çalışma zamanı JSON'ları sürümlenir.

`fetch_capacities.py` resmî kapasite kaynaklarını isteğe bağlı yeniden kontrol eder ve `src/modules/occupancy/assets/capacities.json` dosyasını günceller. Güncellemeleri kapsam, tarih ve kaynak açısından incele.

## Deney sözleşmesi

İki RandomForestRegressor modeli, aynı sekiz giriş/zaman özelliğiyle mevcut an ve t+60 dakika hedeflerini öğrenir. Kronolojik eğitim/doğrulama/test ayrımı korunur. Gelecek olayları veya mevcut/gelecek kişi sayımları model girdisine eklenmez. +60 dakika hedefi aynı gün tam o saatte bulunmuyorsa örnek atılır; boşluklar sıfırla doldurulmaz. Ofis verisi kampüs veya sınav haftası davranışını doğrulamaz.

Veri ve model lisans/atıf bildirimi: [DATA_LICENSE.md](DATA_LICENSE.md). Bildirimi dağıtımlarda koru. Kapasite kayıtları ayrıca resmî URL'lerine atfedilir.
