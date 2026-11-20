import unittest
from validate_pages import valid_post_url
class FamilySourceURLTests(unittest.TestCase):
    def test_specific_inspected_works_only(self):
        for u in ['https://askexclusive.com/mothers-day-prompt/', 'https://khanedits.com/10-gemini-ai-family-photo-prompts-for-matching-outfits/', 'https://aiphoto-prompts.com/indian-mom-and-son-prompt/', 'https://prompthai.in/looks/father-and-kid-matching-kurta-photo/', 'https://www.hixa.in/prompt/viral-mothers-day-crown-portrait-ai-prompt']:
            self.assertTrue(valid_post_url('other',u),u)
            for bad in [u+'?download=1',u+'#other',u.replace('https:','http:'),u.replace('.com/','.com.evil.invalid/').replace('.in/','.in.evil.invalid/')]:
                self.assertFalse(valid_post_url('other',bad),bad)
        for u in ['https://prompthai.in/looks/', 'https://www.hixa.in/family-photo-prompts', 'https://askexclusive.com/category/family/', 'https://askexclusive.com/']:
            self.assertFalse(valid_post_url('other',u),u)
