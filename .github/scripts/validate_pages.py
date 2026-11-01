"""Validate the public snapshot without private data or credentials."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse


EXPECTED_HOSTS = {
    'instagram': {'instagram.com', 'www.instagram.com'},
    'tiktok': {'tiktok.com', 'www.tiktok.com'},
    'youtube': {'youtube.com', 'www.youtube.com', 'youtu.be'},
    'facebook': {'facebook.com', 'www.facebook.com'},
    'threads': {'threads.com', 'www.threads.com', 'threads.net', 'www.threads.net'},
    'other': {'hailuoai.video', 'www.hailuoai.video', 'snapchat.com', 'www.snapchat.com'},
}


def valid_post_url(platform, value):
    try:
        post = urlparse(value)
        if (post.scheme != 'https' or post.username or post.password or post.port
                or post.hostname not in EXPECTED_HOSTS.get(platform, set())
                or post.path in {'', '/'}):
            return False
        if platform == 'other' and post.hostname in {'snapchat.com', 'www.snapchat.com'}:
            return re.fullmatch(
                r'/@[A-Za-z0-9._-]+/spotlight/[A-Za-z0-9_-]+/?', post.path) is not None
        return True
    except (TypeError, ValueError):
        return False


def validate_snapshot(root=Path('site')):
    data = json.loads((root / 'data' / 'materials.json').read_text())
    assert data['schema_version'] == 2
    taxonomy = data['taxonomy']
    assert set(taxonomy) == {'audience_tags', 'theme_tags'}
    assert len(taxonomy['audience_tags']) == 7 and len(taxonomy['theme_tags']) == 31
    assert isinstance(data['materials'], list)
    for item in data['materials']:
        assert set(item['tags']) == set(taxonomy)
        for field, allowed in taxonomy.items():
            assert isinstance(item['tags'][field], list)
            assert set(item['tags'][field]) <= set(allowed)
        assert item['suitability'] in {'safe', 'review'}
        assert valid_post_url(item['platform'], item['post_url']), item['id']
        assert item['media']
        for media in item['media']:
            preview = media.get('preview')
            if preview:
                if item['platform'] == 'youtube' and preview.startswith('https://i.ytimg.com/vi/'):
                    continue  # Official YouTube thumbnail; never copied into this repository.
                assert preview.startswith('assets/') and '..' not in preview
                image = root / preview
                assert image.is_file() and image.stat().st_size > 0
    print(f"Validated {len(data['materials'])} real public records")


if __name__ == '__main__':
    validate_snapshot()
