import unittest
from validate_pages import valid_post_url

class PromptbirdURLTests(unittest.TestCase):
    def test_specific_post_only(self):
        post = 'https://promptbird.in/prompt/indian-family-outdoor-portrait-prompt-copy-paste'
        self.assertTrue(valid_post_url('other', post))
        for u in [post+'?redirect=1', post+'#image', 'https://promptbird.in/library/family',
                  'https://promptbird.in/', post.replace('promptbird.in', 'promptbird.in.evil.example'),
                  post.replace('https:', 'http:')]:
            self.assertFalse(valid_post_url('other', u), u)
