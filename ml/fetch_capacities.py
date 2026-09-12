"""Extract only venue-specific capacity facts from official university pages."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import io
import json
import logging
import re
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).parent
logging.getLogger('pypdf').setLevel(logging.ERROR)
VENUES = [
    dict(id='metu-library', university='ODTÜ', city='Ankara', campus='Merkez Kampüs', name='Merkez Kütüphane', kind='library', capacityType='Oturma kapasitesi', sourceUrl='https://lib.metu.edu.tr/tr/daha-fazla', sourceTitle='ODTÜ Kütüphanesi · Daha Fazla / 2025 istatistikleri', sourceYear=2025, scope='Kütüphane oturma kapasitesi; binadaki herkesin oturduğu anlamına gelmez.'),
    dict(id='hacettepe-osb-dining', university='Hacettepe Üniversitesi', city='Ankara', campus='Başkent OSB Teknik Bilimler MYO', name='MYO Yemekhanesi', kind='cafeteria', capacityType='Yemekhane kişi kapasitesi', sourceUrl='https://universitem.hacettepe.edu.tr/baskent-osb-teknik-bilimler-meslek-yuksekokulu/', sourceTitle='Hacettepe · Başkent OSB Teknik Bilimler MYO tanıtımı', sourceYear=None, scope='Yalnızca Başkent OSB MYO; Beytepe ve Sıhhiye yemekhaneleri değildir.'),
    dict(id='sabanci-dining', university='Sabancı Üniversitesi', city='İstanbul', campus='Tuzla Kampüsü', name='Üniversite Merkezi Ana Yemek Salonu', kind='cafeteria', capacityType='Yemek salonu kişi kapasitesi', sourceUrl='https://www.sabanciuniv.edu/sites/default/files/2025-07/su_genel_tanitim_brosuru-2025-web.pdf', sourceTitle='Sabancı Üniversitesi · 2025 genel tanıtım broşürü, PDF s.19', sourceYear=2025, scope='Ana yemek salonu; günlük servis edilen öğün sayısı değildir.'),
    dict(id='maltepe-library', university='Maltepe Üniversitesi', city='İstanbul', campus='Marmara Eğitim Köyü', name='Kütüphane ve Bilgi Merkezi', kind='library', capacityType='Oturma kapasitesi', sourceUrl='https://kutuphane.maltepe.edu.tr/tr/kutuphane-ve-bilgi-merkezi', sourceTitle='Maltepe Üniversitesi · Kütüphane ve Bilgi Merkezi', sourceYear=None, scope='Merkezdeki 500 koltuk. Fakültelerdeki 480 kişilik okuma salonları hariç.'),
    dict(id='arel-fitness', university='İstanbul Arel Üniversitesi', city='İstanbul', campus='Kemal Gözükara Yerleşkesi', name='Tepekent Fitness Salonu', kind='gym', capacityType='Fitness salonu kişi kapasitesi', sourceUrl='https://kalite.arel.edu.tr/wp-content/uploads/2025/04/2023-2024-UYGAR-Merkezleri-Faaliyet-Raporu.pdf', sourceTitle='Arel · 2023–2024 faaliyet raporu, Tablo II.7, PDF s.27', sourceYear=2024, scope='Yalnızca 161 m² fitness salonunun 30 kişilik kapasitesi. Basketbol tribünü, havuz ve tüm spor merkezinin toplamı değildir.'),
    dict(id='tedu-fitness', university='TED Üniversitesi', city='Ankara', campus='Kolej / Çankaya', name='Fitness Salonu', kind='gym', capacityType='Randevulu fitness kullanım kapasitesi', sourceUrl='https://www.tedu.edu.tr/sites/default/files/docs/KIDR_2024_v6_250429.pdf', sourceTitle='TEDÜ · 2024 Kurum İç Değerlendirme Raporu, PDF s.36', sourceYear=2024, scope='Randevulu sistemle 20 kişilik fitness kullanımı. Spor salonunun seyirci tribünü veya havuz kapasitesi değildir.'),
]


def main():
    results = []
    for config in VENUES:
        response = requests.get(config['sourceUrl'], timeout=40)
        response.raise_for_status()
        soup = None
        pdf_rules = {
            'sabanci-dining': (18, r'(\d+)\s+kişilik\s+kapasiteye'),
            'arel-fitness': (26, r'Tepekent Fitness Salonu\s+(\d+)\s+161'),
            'tedu-fitness': (35, r'Fitness salonu randevulu.{0,150}?(\d+)\s+kişi\s+kapasiteyle'),
        }
        if config['id'] in pdf_rules:
            page, pattern = pdf_rules[config['id']]
            text = PdfReader(io.BytesIO(response.content)).pages[page].extract_text()
            text = text.replace('/idotaccent', 'i')
            found = re.search(pattern, text, flags=re.I | re.S)
        else:
            soup = BeautifulSoup(response.content, 'html.parser')
            text = soup.get_text(' ', strip=True)
            pattern = r'(\d+)\s+kişilik\s+yemekhane' if config['id'] == 'hacettepe-osb-dining' else r'Merkezde\s+(\d+)\s+kişilik\s+oturma'
            found = re.search(pattern, text, flags=re.I)
        if config['id'] == 'metu-library':
            row = next(tr for tr in soup.select('tr') if 'Oturma Kapasitesi' in tr.get_text())
            table = row.find_parent('table')
            header = next(tr for tr in table.select('tr') if '2025' in tr.get_text())
            headers = [cell.get_text(strip=True) for cell in header.find_all(['td', 'th'])]
            cells = [cell.get_text(strip=True) for cell in row.find_all(['td', 'th'])]
            capacity = int(cells[headers.index('2025')].replace('.', ''))
        else:
            if not found:
                raise ValueError(f"Capacity context changed: {config['id']}. Existing output has not been replaced.")
            capacity = int(found.group(1))
        if not 1 <= capacity <= 100000:
            raise ValueError('Invalid capacity')
        results.append({**config, 'capacity': capacity, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sourceSha256': hashlib.sha256(response.content).hexdigest()})
        print(config['university'], capacity, flush=True)
    output = ROOT.parent / 'src/modules/occupancy/assets/capacities.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
