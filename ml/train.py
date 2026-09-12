"""An entry-only occupancy experiment. No current/past exits or occupancy in X."""
from pathlib import Path
import io
import json
import hashlib
import time
import zipfile
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

ROOT = Path(__file__).parent
FEATURES = ['hour', 'weekday', 'entries15', 'entries30', 'entries60', 'entries120', 'entries240', 'entriesToday']


def feature_row(entries, at):
    """entries: timestamp-indexed positive entrance counts, never occupancy labels."""
    stamps = entries.index.as_unit('ns').asi8
    values = entries.to_numpy()
    active = (stamps <= at.value) & (stamps >= at.normalize().value)
    windows = [float(values[active & (stamps > at.value - m * 60 * 1_000_000_000)].sum()) for m in (15, 30, 60, 120, 240)]
    return [at.hour + at.minute / 60, at.weekday(), *windows, float(values[active].sum())]


def prepare():
    source = ROOT / 'data/raw/COD.zip'
    with zipfile.ZipFile(source) as archive:
        frame = pd.read_csv(io.BytesIO(archive.read('COD/Bosch_Office_1/processed_occupancy_FORK_Main_Entrance.csv')))
    frame['timestamp'] = pd.to_datetime(frame.date + ' ' + frame.time, format='%m/%d/%y %H:%M:%S', errors='raise')
    if not frame.timestamp.is_monotonic_increasing or frame.number.isna().any() or frame.number.lt(0).any():
        raise ValueError('Invalid source time order or occupancy count')
    rows, event_days = [], {}
    for date, day in frame.groupby(frame.timestamp.dt.date, sort=True):
        # Source days end at zero. The next day's initial 1/2 is treated as arrivals
        # from an empty start. No occupancy is carried over missing calendar days.
        if day.number.iloc[-1] != 0:
            raise ValueError('Empty end-of-day assumption no longer holds')
        delta = day.number.diff()
        delta.iloc[0] = day.number.iloc[0]
        entrances = pd.Series(delta.clip(lower=0).to_numpy(), index=day.timestamp)
        entrances = entrances.loc[entrances.gt(0)]
        # Keep sequential events sharing one second; netting them loses entrances.
        measured = day.drop_duplicates('timestamp', keep='last').set_index('timestamp').number
        grid = pd.date_range(day.timestamp.iloc[0].ceil('15min'), day.timestamp.iloc[-1].floor('15min'), freq='15min')
        observed = measured.reindex(measured.index.union(grid)).sort_index().ffill().reindex(grid)
        for at, target in observed.items():
            rows.append({'timestamp': at.isoformat(), 'day': str(date), 'target': int(target), **dict(zip(FEATURES, feature_row(entrances, at)))})
        event_days[str(date)] = [{'time': at.isoformat(), 'count': int(value)} for at, value in entrances.items()]
    return pd.DataFrame(rows), event_days, {
        'rawRows': len(frame), 'rawDays': len(event_days), 'sourceMin': str(frame.timestamp.min()),
        'sourceMax': str(frame.timestamp.max()), 'sourceMaxOccupancy': int(frame.number.max()),
        'sameSecondEvents': int(frame.timestamp.duplicated().sum()),
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'usedRoom': 'Bosch Office 1 / Main Entrance',
        'omittedRooms': ['Clemente', 'Warhol'],
        'coverage': 'Only recorded days, from first to last event; 15-minute right-end snapshots. Unrecorded days are not zeros.',
        'label': 'Last observed sensor occupancy at or before timestamp; not manually verified headcount.',
        'entranceReconstruction': 'Positive sequential occupancy deltas (including same-second events); initial daily count treated as entries from empty start. Sensor-derived proxy, not raw card swipes.',
    }


def metrics(y, prediction):
    return {'mae': round(float(mean_absolute_error(y, prediction)), 4), 'rmse': round(float(root_mean_squared_error(y, prediction)), 4)}


def export_forest(model):
    return {'features': FEATURES, 'trees': [
        {'left': e.tree_.children_left.tolist(), 'right': e.tree_.children_right.tolist(),
         'feature': e.tree_.feature.tolist(), 'threshold': e.tree_.threshold.tolist(),
         'value': e.tree_.value[:, 0, 0].tolist()} for e in model.estimators_]}


def main():
    data, events, audit = prepare()
    days = sorted(data.day.unique())
    first, second = int(len(days) * .6), int(len(days) * .8)
    train = data[data.day.isin(days[:first])]
    valid = data[data.day.isin(days[first:second])]
    test = data[data.day.isin(days[second:])]
    # Time-ordered 60/20/20 split: parameter selection sees validation only.
    candidates, fitted = [], []
    started = time.perf_counter()
    for depth in (6, 10):
        model = RandomForestRegressor(n_estimators=80, max_depth=depth, min_samples_leaf=5, random_state=42, n_jobs=-1)
        model.fit(train[FEATURES], train.target)
        score = metrics(valid.target, model.predict(valid[FEATURES]))
        candidates.append({'depth': depth, 'validation': score})
        fitted.append(model)
    best = min(range(len(fitted)), key=lambda i: candidates[i]['validation']['mae'])
    # Refit selected configuration on train + validation; keep future test unseen.
    model = fitted[best]
    development = pd.concat([train, valid])
    model.fit(development[FEATURES], development.target)
    seconds = time.perf_counter() - started
    prediction = np.maximum(0, model.predict(test[FEATURES]))
    # Calibrated fixed-window baseline: select window on validation, never on test.
    baselines = []
    for window in ('entries15', 'entries30', 'entries60', 'entries120', 'entries240'):
        factor = float(np.dot(train[window], train.target) / max(1, np.dot(train[window], train[window])))
        baselines.append((mean_absolute_error(valid.target, valid[window] * factor), window))
    _, window = min(baselines)
    factor = float(np.dot(development[window], development.target) / max(1, np.dot(development[window], development[window])))
    hour_means = development.groupby(['weekday', 'hour']).target.mean()
    clock_prediction = [float(hour_means.get((row.weekday, row.hour), development.target.mean())) for row in test.itertuples()]
    report = {
        'model': 'RandomForestRegressor', 'parameters': {'trees': 80, 'maxDepth': candidates[best]['depth'], 'minSamplesLeaf': 5, 'seed': 42},
        'trainingSeconds': round(seconds, 3), 'audit': audit, 'features': FEATURES,
        'split': {name: {'rows': len(part), 'days': int(part.day.nunique()), 'from': part.timestamp.min(), 'to': part.timestamp.max()} for name, part in [('train', train), ('validation', valid), ('test', test)]},
        'candidates': candidates, 'test': metrics(test.target, prediction),
        'baselines': {'constant': metrics(test.target, np.full(len(test), development.target.mean())),
                      'clock': metrics(test.target, clock_prediction),
                      'fixedWindow': {'window': window, 'coefficient': factor, **metrics(test.target, test[window] * factor)}},
        'limitations': ['Office data, not university/cafeteria data.', 'Source sensor count is an estimate, not independent manual ground truth.', 'Derived entrance events share the sensor source with labels.', 'No exit or occupancy feature is supplied at inference.', 'No campus accuracy or live occupancy claim. Capacity is not a model feature.', 'Occupancy divided by seats measures crowd relative to seats, not exact occupied-seat percentage.'],
    }
    public = ROOT.parent / 'src/modules/occupancy/assets'
    artifacts = ROOT / 'artifacts'
    public.mkdir(parents=True, exist_ok=True)
    artifacts.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifacts / 'occupancy.joblib')
    data.to_csv(artifacts / 'prepared.csv', index=False)
    test = test.copy()
    test['prediction'] = prediction
    test['baseline'] = test[window] * factor
    test.to_csv(artifacts / 'test_predictions.csv', index=False)
    demo = {'source': {'name': 'COD · Bosch Office 1', 'url': 'https://zenodo.org/records/996587', 'license': 'CC BY-SA 4.0'},
            'report': report, 'rows': test.round(6).to_dict(orient='records'),
            'entryDays': {day: events[day] for day in days[second:]} }
    (public / 'demo.json').write_text(json.dumps(demo, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (public / 'forest.json').write_text(json.dumps(export_forest(model), separators=(',', ':')), encoding='utf-8')
    (artifacts / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
