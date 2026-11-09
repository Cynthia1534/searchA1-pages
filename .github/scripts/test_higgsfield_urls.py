import unittest
from validate_pages import valid_post_url


class HiggsfieldPublicURLTests(unittest.TestCase):
    post='https://higgsfield.ai/contests/make-your-action-scene/submissions/3e4d9e92-6933-4d8f-96e6-f5de7b2e225b'
    def test_exact_creator_submission(self):
        self.assertTrue(valid_post_url('other',self.post))
    def test_site_index_and_malformed_or_redirected_urls_rejected(self):
        for url in ['https://higgsfield.ai/','https://higgsfield.ai/contests/make-your-action-scene',self.post+'?redirect=elsewhere',self.post.replace('higgsfield.ai','higgsfield.ai.evil.test'),self.post.replace('https:','http:'),self.post.replace('3e4d9e92','not-a-uuid')]:
            self.assertFalse(valid_post_url('other',url),url)
