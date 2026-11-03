// Optional live smoke test. Start the production server before running this.
import assert from 'node:assert/strict';
import {compareCaptures} from '../dist/server/shared/capture-comparison.js';
const url='https://quotes.toscrape.com/js-delayed/';
async function capture(observationMs){const response=await fetch('http://127.0.0.1:8080/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,observationMs}),signal:AbortSignal.timeout(50000)});const report=await response.json();assert.equal(response.status,200,report.error);return report;}
const first=await capture(1000);
const longer=await capture(10000);
const result=compareCaptures(first,longer);
assert.ok(first.content.renderedHash);
assert.ok(longer.content.renderedHash);
assert.equal(result.rows[0].changed,true,'The public delayed fixture may have changed; inspect the two captures.');
console.log(JSON.stringify({url,firstWords:first.metrics.renderedWords,longerWords:longer.metrics.renderedWords,verdict:result.verdict,sourceVaried:result.sourceVaried},null,2));
