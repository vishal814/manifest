import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import env from '@next/env';
env.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
// Load the actual TypeScript adapter and validation; no mocked AI responses.
const loaded = new Map();
async function moduleUrl(filename) {
  filename = path.resolve(filename);
  if (loaded.has(filename)) return loaded.get(filename);
  let source = (await fs.readFile(filename, 'utf8')).replace(/import ["']server-only["'];?/g, '');
  const imports = [...source.matchAll(/from ["']([^"']+)["']/g)];
  for (const match of imports) {
    const spec = match[1];
    const replacement = spec.startsWith('@/') ? await moduleUrl('src/' + spec.slice(2) + '.ts') : spec.startsWith('.') ? await moduleUrl(path.resolve(path.dirname(filename), spec + '.ts')) : pathToFileURL(require.resolve(spec)).href;
    source = source.replace(match[0], 'from ' + JSON.stringify(replacement));
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const url = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64');
  loaded.set(filename, url); return url;
}
const { extractDocument } = await import(await moduleUrl('src/lib/ai/extract.ts'));
const { equivalentField } = await import(await moduleUrl('src/lib/accuracy.ts'));
const labels = JSON.parse(await fs.readFile('evaluation/labels.json', 'utf8'));
const results = [];
for (const sample of labels) {
  const bytes = await fs.readFile(sample.path);
  const started = Date.now();
  try {
    const actual = await extractDocument(bytes, sample.mime, sample.kind);
    const comparisons = [];
    for (const [field, expected] of Object.entries(sample.fields)) comparisons.push({ field, expected, actual: actual.fields[field]?.value ?? null });
    const rows = Math.max(sample.items.length, actual.items.length);
    for (let row = 0; row < rows; row++) for (const field of ['description','hsn','quantity','unitPrice','lineTotal']) comparisons.push({ field, row: row + 1, expected: sample.items[row]?.[field] ?? null, actual: actual.items[row]?.[field]?.value ?? null });
    for (const comparison of comparisons) comparison.correct = equivalentField(comparison.field, comparison.actual, comparison.expected);
    results.push({ id: sample.id, sha256: createHash('sha256').update(bytes).digest('hex'), milliseconds: Date.now() - started, expectedRows: sample.items.length, actualRows: actual.items.length, comparisons });
    console.log(sample.id + ': ' + comparisons.filter(value => value.correct).length + '/' + comparisons.length);
  } catch { results.push({ id: sample.id, error: 'Extraction failed; no raw provider response recorded.', milliseconds: Date.now() - started }); console.log(sample.id + ': FAILED'); }
}
const comparisons = results.flatMap(result => result.comparisons ?? []);
const present = comparisons.filter(value => value.expected !== null), absent = comparisons.filter(value => value.expected === null);
const report = { evaluatedAt: new Date().toISOString(), model: process.env.VERTEX_MODEL, location: process.env.GOOGLE_CLOUD_LOCATION, documents: labels.length, successfulDocuments: results.filter(result => !result.error).length, summary: { correctPresent: present.filter(value => value.correct).length, expectedPresent: present.length, correctAbsent: absent.filter(value => value.correct).length, expectedAbsent: absent.length }, limitation: 'Small synthetic smoke evaluation, not the client target of 95% accuracy on 200 historical shipments. Reviewer agreement is a separate metric. Failed documents are listed and are not counted as successful field evaluations.', results };
await fs.writeFile('evaluation/latest-results.json', JSON.stringify(report, null, 2) + '\n');
const byField = new Map();
for (const value of comparisons) { const count = byField.get(value.field) ?? { compared: 0, correct: 0 }; count.compared++; if(value.correct)count.correct++; byField.set(value.field, count); }
const lines = ['# Labelled extraction evaluation', '', 'Evaluated: ' + report.evaluatedAt, '', 'Model: ' + report.model + '; location: ' + report.location + '.', '', report.successfulDocuments + '/' + report.documents + ' documents extracted successfully.', '', 'Expected present values: ' + report.summary.correctPresent + '/' + report.summary.expectedPresent + ' correct. Expected absent values: ' + report.summary.correctAbsent + '/' + report.summary.expectedAbsent + ' correctly left empty.', '', report.limitation, '', '| Field | Correct | Compared |', '| --- | ---: | ---: |', ...[...byField].map(([field, count]) => '| ' + field + ' | ' + count.correct + ' | ' + count.compared + ' |'), '', '## Observed differences', ''];
for(const result of results) { if(result.error)lines.push('- ' + result.id + ': ' + result.error); for(const value of result.comparisons ?? [])if(!value.correct)lines.push('- ' + result.id + ' / ' + value.field + (value.row ? ' row ' + value.row : '') + ': expected ' + JSON.stringify(value.expected) + '; extracted ' + JSON.stringify(value.actual) + '.'); }
await fs.writeFile('evaluation/REPORT.md', lines.join('\n').trimEnd() + '\n');
console.log(JSON.stringify(report.summary));
if (report.successfulDocuments !== report.documents) process.exitCode = 1;
