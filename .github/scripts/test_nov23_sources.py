import unittest
from validate_pages import valid_post_url
class Nov23SourcesTests(unittest.TestCase):
 def test_specific_inspected_sources(self):
  paths={'promptzify.com':'/mother-and-daughter-prompt-for-chatgpt/','editsprompts.com':'/mom-and-son-prompt-for-gemini/','karoprompt.in':'/trending-10-indian-family-portrait-image-prompts-for-girls-2026','mkprompt.com':'/prompt/mother-and-son-krishna-themed-portrait','promptratio.com':'/prompt/family-kitchen-flour-fight-laugh','www.media.io':'/image-effects/gemini-father-and-daughter-prompt.html'}
  for host,path in paths.items():
   with self.subTest(host=host):
    url='https://'+host+path
    self.assertTrue(valid_post_url('other',url))
    for bad in ['https://'+host+'/','https://'+host+'/category/family/','https://'+host+'/search?q=family',url+'?unlock=1',url.replace('https:','http:'),url.replace(host,host+'.evil.invalid'),url.replace(host,'user:password@'+host)]:self.assertFalse(valid_post_url('other',bad),bad)
  self.assertFalse(valid_post_url('other','https://media.io/image-effects/arbitrary.html'))
