import unittest
from validate_pages import valid_post_url
class FamilyWorkUrls(unittest.TestCase):
 def test_specific_public_works(self):
  for url in ['https://rawpixel.com/image/15443443/indian-family-smiling-indian-happy','https://www.nohaya.com/prompts/timeless-mother-and-son-portrait']:
   self.assertTrue(valid_post_url('other',url))
   for bad in [url+'?page=2',url+'#more',url.replace('https:', 'http:'),url.replace('.com/','.com.evil.invalid/')]:self.assertFalse(valid_post_url('other',bad))
 def test_no_homepage_category_or_download(self):
  for url in ['https://rawpixel.com/','https://rawpixel.com/search/family','https://rawpixel.com/image/download/123/original','https://rawpixel.com/image/0/test','https://www.nohaya.com/prompts/category/family','https://www.nohaya.com/api/prompt-image/123']:
   self.assertFalse(valid_post_url('other',url))
if __name__=='__main__':unittest.main()
