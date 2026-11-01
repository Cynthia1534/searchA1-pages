"""Exercise the URL gate used by the actual Pages publish job."""
import unittest

from validate_pages import valid_post_url


class PublicPostURLs(unittest.TestCase):
    def test_snapchat_spotlight(self):
        path = '/@snapwith_adu/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYanpkbXpwYnhvAaFip0oWAaFip0n-AAAAAA'
        for host in ('snapchat.com', 'www.snapchat.com'):
            for suffix in ('', '/'):
                with self.subTest(host=host, suffix=suffix):
                    self.assertTrue(valid_post_url('other', 'https://' + host + path + suffix))

    def test_rejects_non_posts_and_unsafe_snapchat_urls(self):
        for url in (
            'https://snapchat.com/',
            'https://snapchat.com/@snapwith_adu',
            'https://snapchat.com/@snapwith_adu/spotlight/',
            'https://snapchat.com/@snapwith_adu/story/video123',
            'https://snapchat.com/@snapwith_adu/spotlight/video123/extra',
            'https://snapchat.com/@snapwith_adu/spotlight/../video123',
            'http://snapchat.com/@snapwith_adu/spotlight/video123',
            'https://snapchat.com.evil.example/@snapwith_adu/spotlight/video123',
            'https://evil.example/@snapwith_adu/spotlight/video123',
            'https://snapchat.com@evil.example/@snapwith_adu/spotlight/video123',
            'https://user:password@snapchat.com/@snapwith_adu/spotlight/video123',
            'https://snapchat.com:8443/@snapwith_adu/spotlight/video123',
            'https://snapchat.com:invalid/@snapwith_adu/spotlight/video123',
        ):
            with self.subTest(url=url):
                self.assertFalse(valid_post_url('other', url))

    def test_existing_platform_hosts_remain_supported(self):
        for platform, url in (
            ('other', 'https://hailuoai.video/fr/generate/ai-video/366726978348642310'),
            ('instagram', 'https://www.instagram.com/reel/DdwQjCap3Ca/'),
            ('tiktok', 'https://www.tiktok.com/@creator/video/123'),
            ('youtube', 'https://www.youtube.com/shorts/PXbnzFWNv7Y'),
            ('facebook', 'https://www.facebook.com/reel/123/'),
            ('threads', 'https://www.threads.com/@creator/post/abc'),
        ):
            with self.subTest(platform=platform):
                self.assertTrue(valid_post_url(platform, url))
        self.assertFalse(valid_post_url('instagram', 'https://snapchat.com/@creator/spotlight/abc'))
        self.assertFalse(valid_post_url('other', 'https://hailuoai.video/'))


if __name__ == '__main__':
    unittest.main()
