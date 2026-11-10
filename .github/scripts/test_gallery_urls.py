import unittest
from validate_pages import valid_post_url

class GalleryURLTests(unittest.TestCase):
    def test_specific_verified_publishers_only(self):
        for host in ['imagepromptlab.com','sushilprompt.com','auraprompt.in']:
            self.assertTrue(valid_post_url('other', 'https://'+host+'/father-daughter-prompt/'))
            for tail in ['/', '/category/', '/category/family/', '/family/?page=2', '/family/#img']:
                self.assertFalse(valid_post_url('other', 'https://'+host+tail))
        for url in ['http://sushilprompt.com/family/', 'https://u@sushilprompt.com/family/',
                    'https://sushilprompt.com:444/family/', 'https://sushilprompt.com.evil.test/family/',
                    'https://unverified.test/family/']:
            self.assertFalse(valid_post_url('other', url))
    def test_existing_platform_checks_retained(self):
        self.assertTrue(valid_post_url('other','https://promptbird.in/prompt/family-photo'))
        self.assertFalse(valid_post_url('other','https://promptbird.in/search?q=family'))
        self.assertTrue(valid_post_url('other','https://www.snapchat.com/@creator/spotlight/ABC123'))
        self.assertFalse(valid_post_url('other','https://www.snapchat.com/@creator'))
