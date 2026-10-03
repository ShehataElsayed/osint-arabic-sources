import test from 'node:test'; import assert from 'node:assert/strict';
import { classifyClaim, decide, chartSpec, wantsChart } from '../site/rag-core.js';
import { barChartSVG } from '../site/rag-chart.js';
const src = [
 { title:'a', claim:'ارتفاع اسعار الخبز 20 في المئة في المدينة', rating:'صحيح', publisher:'p1', text:'ارتفعت اسعار الخبز 20 في المئة' },
 { title:'b', claim:'ارتفاع اسعار الخبز 20 في المئة', rating:'صحيح', publisher:'p2', text:'تاكيد ارتفاع اسعار الخبز' },
];
test('claim types', () => { assert.equal(classifyClaim('ارتفعت 20%'), 'numeric'); assert.equal(classifyClaim('قال الوزير شيئا'), 'attribution'); assert.equal(classifyClaim('لقاح جديد'), 'health'); assert.equal(classifyClaim('مباراة امس'), 'general'); });
test('answers when evidence agrees; flags always false', () => { const r = decide('ارتفاع اسعار الخبز 20 في المئة', src); assert.equal(r.decision, 'answer'); assert.equal(r.validated_for_release, false); assert.equal(r.autonomous_allowed, false); });
test('abstains with no sources / low similarity', () => { assert.deepEqual(decide('سؤال', []).reasons, ['no_sources']); assert.deepEqual(decide('كرة القدم الاوروبية', src).reasons, ['low_similarity']); });
test('abstains on NLI contradiction', () => { const r = decide('ارتفاع اسعار الخبز 20 في المئة', [{ ...src[0], nli:{ contradiction:0.9 } }]); assert.equal(r.decision,'abstain'); assert.ok(r.reasons.includes('contradiction')); });
test('abstains on negation heuristic', () => { const r = decide('ارتفعت اسعار الخبز في المدينة', [{ title:'n', claim:'لم ترتفع اسعار الخبز في المدينة', rating:'كاذب', text:'لم ترتفع اسعار الخبز في المدينة' }]); assert.ok(r.reasons.includes('contradiction')); });
test('abstains on split vote', () => { const r = decide('ارتفاع اسعار الخبز 20 في المئة', [src[0], { ...src[1], rating:'كاذب' }]); assert.ok(r.reasons.includes('split_vote')); });
test('chart uses only real fields; none -> null', () => { const s = chartSpec(src); assert.deepEqual(s.data, [{ label:'صحيح', value:2 }]); assert.equal(barChartSVG(chartSpec([{title:'x'}]), 't'), null); assert.ok(barChartSVG(s,'t').includes('<svg')); assert.ok(wantsChart('مع رسم بياني')); });
test('svg escapes labels', () => { const svg = barChartSVG({ data:[{ label:'<script>', value:1 }] }, 't'); assert.ok(!svg.includes('<script>')); });
test('long text: best sentence drives similarity', () => { const long = 'جملة اولى عن موضوع اخر تماما. ' .repeat(10) + 'انتفاضة الخبز مظاهرات شعبية ضد الغلاء في مصر عام 1977. ' + 'جمل اخرى لا علاقة لها.'.repeat(5); const r = decide('ما هي انتفاضة الخبز عام 1977 في مصر؟', [{ title:'انتفاضة الخبز (1977)', text: long, rating:'' }]); assert.ok(r.evidence[0].similarity >= 0.35); });
test('polarity merges false+misleading votes', () => { const items = [{ title:'a', claim:'فيديو توغل اسرائيلي في درعا', rating:'كاذب', polarity:'false' }, { title:'b', claim:'فيديو توغل اسرائيلي في درعا قديم', rating:'مضلل', polarity:'false' }]; const r = decide('فيديو توغل اسرائيلي في درعا', items); assert.equal(r.decision, 'answer'); });
