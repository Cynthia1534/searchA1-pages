import copy
import json
import unittest
from pathlib import Path

from validate_pages import validate_taxonomy


class DanceTaxonomyTests(unittest.TestCase):
    def test_legacy_and_dance_snapshots_are_both_valid(self):
        taxonomy = json.loads(Path('site/data/materials.json').read_text())['taxonomy']
        validate_taxonomy(taxonomy)
        modern = copy.deepcopy(taxonomy)
        if '舞蹈' not in modern['theme_tags']:
            modern['theme_tags'].append('舞蹈')
        validate_taxonomy(modern)
        for invalid in ('自创标签', '舞蹈'):
            bad = copy.deepcopy(modern)
            bad['theme_tags'].append(invalid)
            with self.assertRaises(AssertionError):
                validate_taxonomy(bad)
