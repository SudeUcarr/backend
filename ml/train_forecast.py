"""Forecast N(t+60m) using entrance/time features available at t only."""
import json
import time
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).parent


def make_future_samples(data):
    data = data.copy()
    origin = pd.to_datetime(data.timestamp)
    future_ns = origin.dt.as_unit('ns').astype('int64') + 60 * 60 * 1_000_000_000
    data['forecastTime'] = pd.to_datetime(future_ns, unit='ns').dt.strftime('%Y-%m-%dT%H:%M:%S')
    lookup = data[['timestamp', 'target']].rename(columns={'timestamp': 'forecastTime', 'target': 'futureTarget'})
    paired = data.merge(lookup, on='forecastTime', how='inner', validate='one_to_one')
    # No label extrapolation, no crossing an overnight gap or a split-day boundary.
    return paired[paired.forecastTime.str[:10] == paired.day].copy()


def main():
    import joblib
    import numpy as np
    from sklearn.ensemble import RandomForestRegressor
    from train import FEATURES, export_forest, metrics

    data = pd.read_csv(ROOT / 'artifacts/prepared.csv')
    paired = make_future_samples(data)
    old_report = json.loads((ROOT / 'artifacts/report.json').read_text(encoding='utf-8'))
    split = {name: paired[paired.timestamp.between(info['from'], info['to'])].copy()
             for name, info in old_report['split'].items()}
    train, valid, test = (split[name] for name in ('train', 'validation', 'test'))
    candidates = []
    started = time.perf_counter()
    for depth in (6, 10):
        model = RandomForestRegressor(n_estimators=80, max_depth=depth, min_samples_leaf=5, random_state=42, n_jobs=-1)
        model.fit(train[FEATURES], train.futureTarget)
        candidates.append({'depth': depth, 'validation': metrics(valid.futureTarget, model.predict(valid[FEATURES]))})
    best = min(candidates, key=lambda item: item['validation']['mae'])
    model = RandomForestRegressor(n_estimators=80, max_depth=best['depth'], min_samples_leaf=5, random_state=42, n_jobs=-1)
    development = pd.concat([train, valid])
    model.fit(development[FEATURES], development.futureTarget)
    seconds = time.perf_counter() - started
    prediction = np.maximum(0, model.predict(test[FEATURES]))
    # Deployable baseline: keep the existing entry-only current estimate unchanged.
    # Do not use the true current occupancy as a deployable persistence baseline.
    now_model = joblib.load(ROOT / 'artifacts/occupancy.joblib')
    hold = now_model.predict(test[FEATURES])
    clock_means = development.groupby(['weekday', 'hour']).futureTarget.mean()
    clock = [float(clock_means.get((row.weekday, row.hour), development.futureTarget.mean())) for row in test.itertuples()]
    report = {
        'horizonMinutes': 60, 'model': 'RandomForestRegressor', 'features': FEATURES,
        'parameters': {'trees': 80, 'maxDepth': best['depth'], 'minSamplesLeaf': 5, 'seed': 42},
        'trainingSeconds': round(seconds, 3), 'candidates': candidates,
        'test': metrics(test.futureTarget, prediction),
        'baselines': {'holdCurrentEstimate': metrics(test.futureTarget, hold), 'clock': metrics(test.futureTarget, clock)},
        'split': {name: {'rows': len(part), 'days': int(part.day.nunique()), 'from': part.timestamp.min(), 'to': part.timestamp.max(), 'lastTargetTime': part.forecastTime.max()} for name, part in split.items()},
        'omittedRowsWithoutFutureLabel': len(data) - len(paired),
        'sourceSha256': old_report['audit']['sha256'],
        'limitations': ['Forecast uses only entry/time features at origin t; no entrances after t, no current/future occupancy as input.',
                       'Target is the recorded sensor count at exactly t+60 minutes on the same recorded day.',
                       'No forecast demonstration beyond recorded daily coverage; no invented closing-hour zeros.',
                       'Office data only; no campus, gym or exam-week training data.',
                       'Temporal holdout reuses the original experiment dates; model choice uses validation only.'],
    }
    test['forecastPrediction'] = prediction
    test['holdPrediction'] = hold
    test.to_csv(ROOT / 'artifacts/forecast_test_predictions.csv', index=False)
    joblib.dump(model, ROOT / 'artifacts/forecast_60.joblib')
    (ROOT / 'artifacts/forecast_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    public = ROOT.parent / 'src/modules/occupancy/assets'
    (public / 'forecast-forest.json').write_text(json.dumps({**export_forest(model), 'horizonMinutes': 60}, separators=(',', ':')), encoding='utf-8')
    rows = test[['timestamp', 'forecastTime', 'futureTarget', 'forecastPrediction']].round(6).to_dict(orient='records')
    (public / 'forecast.json').write_text(json.dumps({'report': report, 'rows': rows}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
