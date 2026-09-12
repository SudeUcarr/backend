import unittest
import pandas as pd
from train_forecast import make_future_samples


class FutureTargetTests(unittest.TestCase):
    def test_pairs_exact_hour_preserving_origin_features(self):
        data = pd.DataFrame([
            {'timestamp': '2016-01-01T11:00:00', 'day': '2016-01-01', 'target': 4, 'entries15': 3},
            {'timestamp': '2016-01-01T12:00:00', 'day': '2016-01-01', 'target': 8, 'entries15': 99},
        ])
        result = make_future_samples(data)
        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0].futureTarget, 8)
        self.assertEqual(result.iloc[0].entries15, 3)

    def test_does_not_shift_to_next_available_record_or_next_day(self):
        data = pd.DataFrame([
            {'timestamp': '2016-01-01T11:00:00', 'day': '2016-01-01', 'target': 4},
            {'timestamp': '2016-01-01T12:15:00', 'day': '2016-01-01', 'target': 9},
            {'timestamp': '2016-01-01T23:30:00', 'day': '2016-01-01', 'target': 1},
            {'timestamp': '2016-01-02T00:30:00', 'day': '2016-01-02', 'target': 2},
        ])
        self.assertTrue(make_future_samples(data).empty)


if __name__ == '__main__':
    unittest.main()
