export interface Entry { time: string; count: number }
export interface Tree { left: number[]; right: number[]; feature: number[]; threshold: number[]; value: number[] }
export interface Forest { features: string[]; trees: Tree[]; horizonMinutes?: number }
export const featureNames = ['hour', 'weekday', 'entries15', 'entries30', 'entries60', 'entries120', 'entries240', 'entriesToday'];

// Source wall-clock timestamps are kept unchanged, independent of browser timezone.
// An actual card integration must convert its timestamps to the venue's local clock first.
function wallClock(time: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(time)) throw new Error('Yerel zaman YYYY-MM-DDTHH:mm:ss biçiminde olmalı.');
  const date = new Date(time + 'Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== time) throw new Error('Geçersiz zaman.');
  return date;
}

export function buildFeatures(entries: Entry[], asOf: string): number[] {
  const at = wallClock(asOf);
  const windows = [15, 30, 60, 120, 240];
  const sums = [0, 0, 0, 0, 0];
  let today = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.count) || entry.count < 0) throw new Error('Giriş sayısı negatif olmayan tam sayı olmalı.');
    const time = wallClock(entry.time).getTime();
    if (time > at.getTime() || entry.time.slice(0, 10) !== asOf.slice(0, 10)) continue;
    today += entry.count;
    windows.forEach((minutes, index) => { if (time > at.getTime() - minutes * 60000) sums[index] += entry.count; });
  }
  return [at.getUTCHours() + at.getUTCMinutes() / 60, (at.getUTCDay() + 6) % 7, ...sums, today];
}

export function predict(forest: Forest, features: number[]) {
  if (forest.features.join('|') !== featureNames.join('|') || !forest.trees.length) throw new Error('Uyumsuz model.');
  if (features.length !== featureNames.length || features.some(x => !Number.isFinite(x) || x < 0)) throw new Error('Geçersiz model girdisi.');
  // sklearn's tree predictor casts inputs to float32 before comparing thresholds.
  const values = features.map(Math.fround);
  const sum = forest.trees.reduce((total, tree) => {
    let node = 0;
    while (tree.left[node] !== -1) node = values[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    return total + tree.value[node];
  }, 0);
  return Math.max(0, sum / forest.trees.length);
}

export function predictFuture(forest: Forest, originFeatures: number[]) {
  if (forest.horizonMinutes !== 60) throw new Error('60 dakika tahmin modeli gerekli.');
  return predict(forest, originFeatures);
}
