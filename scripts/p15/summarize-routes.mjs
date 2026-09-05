import { readFile, writeFile } from 'node:fs/promises';

const inputs = process.argv.slice(2);
if (inputs.length === 0) throw new Error('请传入至少一个测量 JSON');

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function rounded(value) {
  return value == null ? null : Math.round(value * 10) / 10;
}

const metrics = [
  'responseStart', 'fcp', 'shellAt', 'firstCirclesAt', 'allCirclesAt',
  'domContentLoaded', 'loadEvent', 'cls', 'longestTask', 'transferBytes',
];
const result = [];

for (const input of inputs) {
  const report = JSON.parse(await readFile(input, 'utf8'));
  for (const route of report.routes) {
    const samples = report.samples.filter((sample) => sample.route === route || sample.route === route.replace(/\/score\/1$/, '/score/1'));
    const valid = samples.filter((sample) => !sample.error);
    const summary = {
      input,
      measuredAt: report.measuredAt,
      mode: report.mode,
      route,
      requested: samples.length,
      valid: valid.length,
      errors: samples.length - valid.length,
      metrics: {},
    };
    for (const metric of metrics) {
      const values = valid.map((sample) => sample[metric]).filter(Number.isFinite);
      summary.metrics[metric] = {
        p50: rounded(percentile(values, 0.5)),
        p90: rounded(percentile(values, 0.9)),
        p95: rounded(percentile(values, 0.95)),
        max: rounded(values.length ? Math.max(...values) : null),
      };
    }
    result.push(summary);
  }
}

const output = process.env.P15_SUMMARY_OUTPUT ?? 'reviews/evidence/p15-baseline/route-summary.json';
await writeFile(output, JSON.stringify(result, null, 2));
console.log(`已汇总 ${result.length} 个 route/mode 组合到 ${output}`);
