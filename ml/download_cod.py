"""Fetch the versioned, public COD source; verify publisher's checksum."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import requests

ROOT = Path(__file__).parent


def main():
    directory = ROOT / 'data' / 'raw'
    directory.mkdir(parents=True, exist_ok=True)
    response = requests.get('https://zenodo.org/api/records/996587', timeout=45)
    response.raise_for_status()
    metadata = response.json()
    source = next(f for f in metadata['files'] if f['key'] == 'COD.zip')
    response = requests.get(source['links']['self'], timeout=45)
    response.raise_for_status()
    checksum = 'md5:' + hashlib.md5(response.content).hexdigest()
    if checksum != source['checksum']:
        raise ValueError('Source checksum mismatch')
    (directory / 'COD.zip').write_bytes(response.content)
    (directory / 'cod_metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    (directory / 'cod_manifest.json').write_text(json.dumps({
        'url': source['links']['self'], 'doi': '10.5281/zenodo.996587',
        'license': metadata['metadata']['license']['id'],
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
        'sha256': hashlib.sha256(response.content).hexdigest(), 'publisher_checksum': checksum,
    }, indent=2), encoding='utf-8')
    print('COD.zip downloaded and checksum verified.')


if __name__ == '__main__':
    main()
