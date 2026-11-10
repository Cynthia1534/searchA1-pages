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
    'other': {'hailuoai.video', 'www.hailuoai.video', 'snapchat.com', 'www.snapchat.com', 'higgsfield.ai', 'promptbird.in', 'imagepromptlab.com', 'sushilprompt.com', 'auraprompt.in'},
}

EXPECTED_THEMES = set(['情侣写真','舞蹈','单人写真','亲子家庭写真','宝宝儿童写真','耍帅','节庆','短剧剧情','新品类探索'])
LEGACY_THEMES = set('性感舞蹈 摇腿舞 花海 雪山 海边 80复古 拼贴 海报 锁屏 多宫格 耍帅 闪光灯 拍立得 人与动物 孕照 黑白摄影 多重曝光 剧情 纱丽 骑马 开车 拥抱 亲密互动 墨镜 棚拍 纯色暗调 排灯节 克里希纳诞辰 象头神节 九夜节 十胜节 亡灵节 印度独立日 舞蹈'.split())


def validate_taxonomy(taxonomy):
    assert set(taxonomy) == {'audience_tags', 'theme_tags'}
    assert taxonomy['audience_tags'] == ['亲子家庭','宝宝儿童','单人男性','单人女性','情侣','朋友','单人通用']
    themes = taxonomy['theme_tags']
    # Accept the previous snapshot during the existing cross-repository sync.
    assert len(themes) == len(set(themes))
    if set(themes) == EXPECTED_THEMES:
        assert themes == ['情侣写真','舞蹈','单人写真','亲子家庭写真','宝宝儿童写真','耍帅','节庆','短剧剧情','新品类探索']
    else:
        # Allow an older deployed snapshot while the private-source sync runs.
        assert set(themes) in (LEGACY_THEMES, LEGACY_THEMES - {'舞蹈'})
        # The superseded labels only exist in the legacy taxonomy.
        black_white = themes.index('黑白摄影')
        assert themes[black_white:black_white + 4] == ['黑白摄影','多重曝光','剧情','纱丽']


def valid_post_url(platform, value):
    try:
        post = urlparse(value)
        if (post.scheme != 'https' or post.username or post.password or post.port
                or post.hostname not in EXPECTED_HOSTS.get(platform, set())
                or post.path in {'', '/'}):
            return False
        if platform == 'other' and post.hostname in {'imagepromptlab.com', 'sushilprompt.com', 'auraprompt.in'}:
            return (not post.query and not post.fragment
                    and post.path.strip('/') not in {'category', 'tag', 'search', 'about', 'contact'}
                    and re.fullmatch(r'/[a-z0-9]+(?:-[a-z0-9]+)*/?', post.path) is not None)
        if platform == 'other' and post.hostname == 'promptbird.in':
            return (not post.query and not post.fragment and re.fullmatch(
                r'/prompt/[a-z0-9]+(?:-[a-z0-9]+)*/?', post.path) is not None)
        if platform == 'other' and post.hostname == 'higgsfield.ai':
            return (not post.query and not post.fragment and re.fullmatch(
                r'/contests/make-your-action-scene/submissions/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/?', post.path) is not None)
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
    validate_taxonomy(taxonomy)
    assert isinstance(data['materials'], list)
    for item in data['materials']:
        assert set(item['tags']) == set(taxonomy)
        for field, allowed in taxonomy.items():
            assert isinstance(item['tags'][field], list)
            assert set(item['tags'][field]) <= set(allowed)
        assert item['suitability'] in {'safe', 'review'}
        if '舞蹈' in taxonomy['theme_tags'] and item.get('material_kind') == 'human_ai_dance_video':
            assert item.get('theme_tag') == '舞蹈', item['id']
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
