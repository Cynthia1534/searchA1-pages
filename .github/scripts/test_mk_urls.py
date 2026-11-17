import unittest
from validate_pages import valid_post_url


class MKUrlTests(unittest.TestCase):
    def test_only_specific_https_work_pages(self):
        self.assertTrue(valid_post_url('other', 'https://editmk.com/prompt/family-portraits/'))
        for value in ['http://editmk.com/prompt/family-portraits/', 'https://editmk.com/',
                      'https://editmk.com/prompt/', 'https://editmk.com/search/family',
                      'https://editmk.com/prompt/family?other=1', 'https://editmk.com/prompt/family#other',
                      'https://editmk.com:443/prompt/family', 'https://x@editmk.com/prompt/family',
                      'https://editmk.com.example.org/prompt/family', 'https://cdn.editmk.com/prompt/family']:
            self.assertFalse(valid_post_url('other', value), value)
